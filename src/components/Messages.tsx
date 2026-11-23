import { useState } from "react";
import type { StoredMessage, ToolCall } from "../../server/types";
import { Markdown } from "./Markdown";
import { Icon } from "./Icons";
import { htmlBlocks } from "./ArtifactPreview";

export interface LiveTool {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  output?: string;
}

export interface LivePerm {
  id: string;
  name: string;
  risk: string;
  summary: string;
  answered?: "once" | "always" | "deny";
}

// Verbo, singular e plural de cada ferramenta, para a linha-resumo.
const VERBS: Record<string, [string, string, string]> = {
  read_file: ["leu", "arquivo", "arquivos"],
  write_file: ["editou", "arquivo", "arquivos"],
  edit_file: ["editou", "arquivo", "arquivos"],
  run_command: ["executou", "comando", "comandos"],
  web_search: ["pesquisou na web", "", ""],
  web_fetch: ["abriu", "página", "páginas"],
  list_dir: ["listou", "pasta", "pastas"],
  search_text: ["pesquisou código", "", ""],
  load_skill: ["carregou", "skill", "skills"],
};

/** "Leu 2 arquivos, executou 1 comando" a partir dos nomes das ferramentas usadas. */
export function toolSummary(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) {
    const v = VERBS[n] ?? ["usou", "ferramenta", "ferramentas"];
    const key = v.join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([key, n]) => {
    const [verb, one, many] = key.split("|");
    return one ? `${verb} ${n} ${n === 1 ? one : many}` : verb;
  });
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function argPreview(args: Record<string, unknown>): string {
  const main = args.path ?? args.command ?? args.query ?? args.url ?? args.name ?? args.pattern;
  return typeof main === "string" ? main : JSON.stringify(args).slice(0, 120);
}

function plainText(md: string): string {
  return md.replace(/```[\s\S]*?```/g, " bloco de código. ").replace(/[`*_#>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

export function UserMessage({ m, onEdit, disabled }: { m: StoredMessage; onEdit: (m: StoredMessage) => void; disabled: boolean }) {
  const persisted = !m.id.startsWith("tmp-");
  return (
    <div className="msg user">
      <div className="bubble">{m.content}</div>
      {persisted && (
        <div className="msg-actions">
          <CopyButton text={m.content} />
          <button onClick={() => onEdit(m)} disabled={disabled} title="Editar e reenviar" aria-label="Editar"><Icon name="pencil" size={15} /></button>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }).catch(() => undefined);
      }}
      title={done ? "Copiado" : "Copiar"}
      aria-label="Copiar"
    >
      <Icon name={done ? "check" : "copy"} size={15} />
    </button>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return (
    <button
      className={speaking ? "on" : ""}
      onClick={() => {
        const synth = window.speechSynthesis;
        if (speaking) {
          synth.cancel();
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(plainText(text));
        const chosen = synth.getVoices().find((v) => v.voiceURI === localStorage.getItem("zenith-voice"));
        if (chosen) u.voice = chosen;
        u.lang = chosen?.lang ?? "pt-BR";
        u.rate = Number(localStorage.getItem("zenith-rate") ?? "1") || 1;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        synth.cancel();
        synth.speak(u);
        setSpeaking(true);
      }}
      title={speaking ? "Parar leitura" : "Ler em voz alta (voz do sistema)"}
      aria-label="Ler em voz alta"
    >
      <Icon name={speaking ? "stop" : "speaker"} size={15} />
    </button>
  );
}

/** Linha recolhida com as ferramentas usadas; abre para mostrar cada chamada e o resultado. */
function ToolGroup({ calls, results }: { calls: { id: string; name: string; args: Record<string, unknown>; status?: LiveTool["status"]; output?: string }[]; results?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const running = calls.some((c) => c.status === "running");
  const failed = calls.some((c) => c.status === "error");
  return (
    <div className={`tool-group ${open ? "open" : ""}`}>
      <button className="tool-summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {running && <span className="spinner" />}
        <span>{toolSummary(calls.map((c) => c.name))}</span>
        {failed && <span className="tool-fail">com falha</span>}
        <Icon name={open ? "chevron" : "right"} size={13} />
      </button>
      {open && (
        <div className="tool-list">
          {calls.map((c) => {
            const out = c.output ?? results?.[c.id];
            return (
              <details key={c.id} className={`tool-item ${c.status ?? "ok"}`}>
                <summary>
                  <span className="tool-name">{c.name}</span>
                  <code>{argPreview(c.args)}</code>
                </summary>
                {out ? <pre>{out.slice(0, 4000)}</pre> : <pre className="muted">Sem saída registrada.</pre>}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AssistantMessage({ m, results, onPreview, onRegenerate, disabled, feedback, onFeedback, isLast }: { m: StoredMessage; results?: Record<string, string>; onPreview: (html: string) => void; onRegenerate?: () => void; disabled: boolean; feedback?: string; onFeedback?: (v: "up" | "down" | null) => void; isLast?: boolean }) {
  const artifacts = htmlBlocks(m.content);
  const calls: ToolCall[] = m.toolCalls ?? [];
  return (
    <div className={`msg assistant ${isLast ? "last" : ""}`}>
      {calls.length > 0 && <ToolGroup calls={calls} results={results} />}
      {m.content ? <div className="body"><Markdown text={m.content} /></div> : null}
      {artifacts.map((html, i) => {
        const title = /<title>(.*?)<\/title>/i.exec(html)?.[1] ?? `Página HTML ${artifacts.length > 1 ? i + 1 : ""}`;
        return (
          <button key={i} className="artifact-card" onClick={() => onPreview(html)}>
            <span className="artifact-icon"><Icon name="code" size={18} /></span>
            <span className="grow">
              <strong>{title}</strong>
              <small>HTML · clique para abrir a pré-visualização</small>
            </span>
            <span className="btn">Abrir</span>
          </button>
        );
      })}
      {m.content && (
        <div className="msg-actions">
          <CopyButton text={m.content} />
          <SpeakButton text={m.content} />
          <button className={feedback === "up" ? "on" : ""} onClick={() => onFeedback?.(feedback === "up" ? null : "up")} title="Boa resposta (fica só neste computador)" aria-label="Boa resposta"><Icon name="thumbUp" size={15} /></button>
          <button className={feedback === "down" ? "on" : ""} onClick={() => onFeedback?.(feedback === "down" ? null : "down")} title="Resposta ruim (fica só neste computador)" aria-label="Resposta ruim"><Icon name="thumbDown" size={15} /></button>
          {onRegenerate && <button onClick={onRegenerate} disabled={disabled} title="Gerar de novo" aria-label="Gerar de novo"><Icon name="refresh" size={15} /></button>}
        </div>
      )}
    </div>
  );
}

export function LiveAssistant({ text, tools, perms, onAnswer }: { text: string; tools: LiveTool[]; perms: LivePerm[]; onAnswer: (id: string, d: "once" | "always" | "deny") => void }) {
  return (
    <div className="msg assistant">
      {tools.length > 0 && <ToolGroup calls={tools} />}
      {perms.map((p) => <PermissionCard key={p.id} p={p} onAnswer={onAnswer} />)}
      {text ? <div className="body"><Markdown text={text} /></div> : <div className="typing"><span /><span /><span /></div>}
    </div>
  );
}

export function PermissionCard({ p, onAnswer }: { p: LivePerm; onAnswer: (id: string, d: "once" | "always" | "deny") => void }) {
  const riskLabel: Record<string, string> = { write: "escrever arquivo", exec: "executar comando", network: "acessar a rede" };
  return (
    <div className="perm">
      <div className="perm-head"><Icon name="shield" size={15} /> Permitir {riskLabel[p.risk] ?? p.risk}?</div>
      <code className="perm-summary">{p.summary}</code>
      {p.answered ? (
        <div className="perm-done">{p.answered === "deny" ? "Negado" : p.answered === "always" ? "Permitido sempre para este padrão" : "Permitido uma vez"}</div>
      ) : (
        <div className="perm-actions">
          <button className="btn primary" onClick={() => onAnswer(p.id, "once")}>Permitir uma vez</button>
          <button className="btn" onClick={() => onAnswer(p.id, "always")}>Sempre permitir</button>
          <button className="btn ghost" onClick={() => onAnswer(p.id, "deny")}>Negar</button>
        </div>
      )}
    </div>
  );
}
