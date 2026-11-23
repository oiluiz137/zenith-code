import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Mode, ProviderConfig } from "../../server/types";
import { Icon } from "./Icons";

export const MODE_LABELS: Record<Mode, string> = {
  ask: "Perguntar",
  accept_edits: "Aceitar edições",
  plan: "Plano",
  bypass: "Sem aprovação",
};

const MODE_HINTS: Record<Mode, string> = {
  ask: "Pede aprovação antes de editar arquivos ou rodar comandos",
  accept_edits: "Edita arquivos sem perguntar; comandos ainda pedem aprovação",
  plan: "Só lê e planeja; não altera nada",
  bypass: "Roda tudo sem perguntar. Use com cuidado",
};

export interface Attachment {
  name: string;
  content: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  attachments: Attachment[];
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (i: number) => void;
  providers: ProviderConfig[];
  providerId: string;
  onProvider: (id: string) => void;
  models: string[];
  model: string;
  onModel: (m: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  editing: boolean;
  onCancelEdit: () => void;
  onOpenView: (v: "projects" | "settings") => void;
  onToast: (msg: string) => void;
  folder?: string;
  onPickFolder?: () => void;
  toolFlags: { web: boolean; mcp: boolean; skills: boolean; exec: boolean };
  onToolFlags: (f: { web: boolean; mcp: boolean; skills: boolean; exec: boolean }) => void;
  skills?: { name: string; description: string }[];
  big?: boolean;
  placeholder?: string;
}

type Pop = "attach" | "tools" | "model" | "mode" | null;

/** Nome curto do modelo para o rodapé do compositor (sem extensão e sem quantização). */
function shortModel(m: string): string {
  return m.replace(/\.gguf$/i, "").replace(/[-_.]?Q\d.*$/i, "") || m;
}

export function Composer(p: Props) {
  const [pop, setPop] = useState<Pop>(null);
  const tools = p.toolFlags;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!pop) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPop(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pop]);

  // A caixa cresce com o texto até um limite.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`;
  }, [p.value]);

  useEffect(() => {
    if (p.editing) taRef.current?.focus();
  }, [p.editing]);

  // Sugestões de skills ao digitar "/" no início.
  const slash = p.value.startsWith("/") && !p.value.includes(" ") ? p.value.slice(1).toLowerCase() : null;
  const builtins = [
    { name: "compact", description: "Resume a conversa para liberar contexto" },
    { name: "init", description: "Cria um ZENITH.md com o contexto do projeto" },
    { name: "memory", description: "Mostra a memória persistente" },
    { name: "skills", description: "Lista as skills disponíveis" },
    { name: "permissions", description: "Mostra as regras de permissão" },
  ];
  const suggestions = slash === null ? [] : [...builtins, ...(p.skills ?? [])].filter((s) => s.name.toLowerCase().includes(slash)).slice(0, 7);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (suggestions.length > 0 && slash !== null && !suggestions.some((s) => s.name === slash)) {
        p.onChange(`/${suggestions[0].name} `);
        return;
      }
      if (!p.streaming) p.onSend();
    } else if (e.key === "Escape" && p.editing) {
      p.onCancelEdit();
    }
  }

  const canSend = p.value.trim().length > 0 || p.attachments.length > 0;
  const providerName = p.providers.find((x) => x.id === p.providerId)?.name ?? "Modelo";
  const toolsOn = Object.values(tools).filter(Boolean).length;

  return (
    <div className={`composer-wrap ${p.big ? "big" : ""}`} ref={boxRef}>
      {p.editing && (
        <div className="edit-note">
          Editando uma mensagem. Ao enviar, as respostas seguintes são substituídas.
          <button className="link" onClick={p.onCancelEdit}>Cancelar (Esc)</button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="slash-menu" role="listbox">
          {suggestions.map((s) => (
            <button key={s.name} onClick={() => { p.onChange(`/${s.name} `); taRef.current?.focus(); }}>
              <span className="slash-name">/{s.name}</span>
              <span className="slash-desc">{s.description}</span>
            </button>
          ))}
        </div>
      )}
      <div className="composer">
        {p.attachments.length > 0 && (
          <div className="file-chips">
            {p.attachments.map((a, i) => (
              <span key={i} className="file-chip">
                <Icon name="doc" size={14} /> {a.name}
                <button onClick={() => p.onRemoveAttachment(i)} aria-label={`Remover ${a.name}`}><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="composer-main">
          <textarea
            ref={taRef}
            value={p.value}
            onChange={(e) => p.onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={p.placeholder ?? (p.big ? "Como posso ajudar?" : "Responder")}
            rows={1}
            disabled={p.streaming}
            aria-label="Mensagem"
          />
          {p.streaming ? (
            <button className="send stop" onClick={p.onStop} title="Parar" aria-label="Parar"><Icon name="stop" size={13} /></button>
          ) : (
            <button className="send" onClick={p.onSend} disabled={!canSend} title={p.editing ? "Reenviar (Enter)" : "Enviar (Enter)"} aria-label="Enviar"><Icon name="enter" size={17} /></button>
          )}
        </div>
      </div>

      <div className="composer-under">
        <div className="popover-wrap">
          <button className="icon-btn" onClick={() => setPop(pop === "attach" ? null : "attach")} title="Adicionar arquivos, projeto ou skill" aria-label="Adicionar">
            <Icon name="plus" size={17} />
          </button>
          {pop === "attach" && (
            <div className="popover up">
              <button onClick={() => { setPop(null); fileRef.current?.click(); }}><Icon name="clip" size={15} /> Anexar arquivo de texto</button>
              {p.onPickFolder && <button onClick={() => { setPop(null); p.onPickFolder?.(); }}><Icon name="folder" size={15} /> Escolher pasta de trabalho</button>}
              <button onClick={() => { setPop(null); p.onOpenView("projects"); }}><Icon name="layers" size={15} /> Usar um projeto</button>
              <button onClick={() => { setPop(null); p.onChange("/"); taRef.current?.focus(); }}><Icon name="spark" size={15} /> Usar uma skill</button>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { p.onAttachFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />

        <div className="popover-wrap">
          <button className={`icon-btn ${toolsOn < 4 ? "dim" : ""}`} onClick={() => setPop(pop === "tools" ? null : "tools")} title={`Ferramentas da conversa (${toolsOn} de 4 ligadas)`} aria-label="Ferramentas">
            <Icon name="sliders" size={17} />
          </button>
          {pop === "tools" && (
            <div className="popover up">
              <div className="menu-label">Ferramentas desta conversa</div>
              {([["web", "Pesquisa na web", "globe"], ["mcp", "Servidores MCP", "plug"], ["skills", "Skills", "spark"], ["exec", "Executar comandos", "terminal"]] as const).map(([k, label, icon]) => (
                <button key={k} onClick={() => p.onToolFlags({ ...tools, [k]: !tools[k] })} role="switch" aria-checked={tools[k]}>
                  <Icon name={icon} size={15} /> <span className="grow">{label}</span>
                  <span className={`switch sm ${tools[k] ? "on" : ""}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="disclaimer">O Zenith é uma IA e pode cometer erros.</span>

        <div className="popover-wrap">
          <button className="text-btn strong" onClick={() => setPop(pop === "model" ? null : "model")} title={`Provedor: ${providerName}`}>
            {p.model ? shortModel(p.model) : "Escolher modelo"}
          </button>
          {pop === "model" && (
            <div className="popover up right wide">
              <div className="menu-label">Provedor</div>
              {p.providers.filter((x) => x.enabled || x.id === p.providerId).map((x) => (
                <button key={x.id} onClick={() => p.onProvider(x.id)}>
                  <span className="grow">{x.name}</span> {x.id === p.providerId ? <span className="check"><Icon name="check" size={14} /></span> : null}
                </button>
              ))}
              <div className="menu-label">Modelo</div>
              {p.models.length === 0 && <div className="menu-label">Nenhum modelo encontrado em {providerName}.</div>}
              {p.models.map((m) => (
                <button key={m} onClick={() => { p.onModel(m); setPop(null); }}>
                  <span className="grow ellipsis">{m}</span>
                  {p.model === m ? <span className="check"><Icon name="check" size={14} /></span> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="popover-wrap">
          <button className={`text-btn ${p.mode === "bypass" ? "warn" : ""}`} onClick={() => setPop(pop === "mode" ? null : "mode")} aria-label={`Modo de permissão: ${MODE_LABELS[p.mode]}`} title="Quando o agente pede aprovação">
            {MODE_LABELS[p.mode]}
          </button>
          {pop === "mode" && (
            <div className="popover up right wide">
              <div className="menu-label">Modo de permissão</div>
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <button key={m} onClick={() => { p.onMode(m); setPop(null); }} className="two-line">
                  <span className="grow">
                    <span>{MODE_LABELS[m]}</span>
                    <small>{MODE_HINTS[m]}</small>
                  </span>
                  {p.mode === m ? <span className="check"><Icon name="check" size={14} /></span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
