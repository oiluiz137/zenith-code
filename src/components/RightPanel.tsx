import { useEffect, useState } from "react";
import type { Mode, StoredMessage } from "../../server/types";
import { api } from "../api";
import { Icon, type IconName } from "./Icons";
import { htmlBlocks } from "./ArtifactPreview";
import { Terminal } from "./Terminal";
import { MODE_LABELS } from "./Composer";
import { EditsReview } from "./EditsReview";
import type { AgentEdit } from "../api";

export type PanelTab = "visao" | "terminal" | "tarefas" | "navegador" | "arquivos" | "alteracoes" | "auditoria";

export const PANEL_TABS: { id: PanelTab; label: string; icon: IconName }[] = [
  { id: "visao", label: "Visão geral", icon: "list" },
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "tarefas", label: "Tarefas em segundo plano", icon: "inbox" },
  { id: "navegador", label: "Navegador", icon: "globe" },
  { id: "arquivos", label: "Arquivos", icon: "folder" },
  { id: "alteracoes", label: "Alterações", icon: "share" },
  { id: "auditoria", label: "Auditoria", icon: "shield" },
];

interface Props {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  conversationId: string | null;
  folder: string;
  workspace: string;
  messages: StoredMessage[];
  streaming: boolean;
  permMode: Mode;
  onPreview: (html: string) => void;
  onPickFolder: () => void;
  onCompact: () => void;
  onClose: () => void;
  onNotice: (msg: string) => void;
  onOpenSettings: () => void;
  edits: AgentEdit[];
  onEditsChanged: () => void;
}

export function RightPanel(p: Props) {
  const [openFile, setOpenFile] = useState<string | null>(null);
  const current = PANEL_TABS.find((t) => t.id === p.tab) ?? PANEL_TABS[0];

  return (
    <aside className="rpanel" aria-label="Painel lateral">
      <div className="rpanel-head">
        {p.tab !== "visao" && (
          <button className="icon-btn" onClick={() => p.onTab("visao")} title="Voltar à visão geral" aria-label="Voltar à visão geral"><Icon name="left" size={15} /></button>
        )}
        <span className="rpanel-title">{current.label}</span>
        <button className="icon-btn" onClick={p.onClose} title="Fechar painel (Ctrl+J)" aria-label="Fechar painel"><Icon name="x" size={15} /></button>
      </div>
      <div className="rpanel-body">
        {p.tab === "visao" && (
          <Overview {...p} onOpenFile={(path) => { setOpenFile(path); p.onTab("arquivos"); }} />
        )}
        {p.tab === "terminal" && <div className="rpad"><Terminal onClose={() => p.onTab("visao")} inline /></div>}
        {p.tab === "tarefas" && <div className="rpad"><JobsView conversationId={p.conversationId} onNotice={p.onNotice} /></div>}
        {p.tab === "navegador" && <BrowserView messages={p.messages} />}
        {p.tab === "arquivos" && <div className="rpad"><FilesView base={p.folder || p.workspace} openPath={openFile} /></div>}
        {p.tab === "alteracoes" && (
          <div className="rpad">
            <h4 className="rsub">Edições do agente</h4>
            {p.edits.length === 0 ? <p className="hint">O agente ainda não alterou arquivos nesta conversa.</p> : <EditsReview edits={p.edits} onChanged={p.onEditsChanged} onNotice={p.onNotice} compact />}
            <h4 className="rsub">Git</h4>
            <GitView conversationId={p.conversationId} streaming={p.streaming} />
          </div>
        )}
        {p.tab === "auditoria" && <div className="rpad"><Audit messages={p.messages} /></div>}
      </div>
    </aside>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

function shortPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length > 3 ? `${parts[0]}\\…\\${parts.slice(-2).join("\\")}` : p;
}

const CTX_COLORS = ["#4f8ef7", "#e0703a", "#2fb38a", "#d9a03f", "#9b8cf2"];

function Overview(p: Props & { onOpenFile: (path: string) => void }) {
  const base = p.folder || p.workspace;
  const folderName = base.split(/[\\/]/).filter(Boolean).pop() ?? base;
  return (
    <>
      <section className="rsec">
        <h4>Ambiente</h4>
        <div className="rrow"><Icon name="laptop" size={16} /><span className="grow">Este computador</span><span className="muted small">sem nuvem</span></div>
        <div className="rrow">
          <Icon name="folder" size={16} />
          <span className="grow ellipsis" title={base}>{folderName} <span className="muted">· {shortPath(base)}</span></span>
          <button className="link" onClick={p.onPickFolder}>Trocar</button>
        </div>
        <div className="rrow"><Icon name="shield" size={16} /><span className="grow">Permissões</span><span className="muted small">{MODE_LABELS[p.permMode]}</span></div>
      </section>

      <section className="rsec">
        <h4>Contexto</h4>
        <ContextView conversationId={p.conversationId} messages={p.messages} streaming={p.streaming} onCompact={p.onCompact} />
      </section>

      <section className="rsec">
        <button className="rrow clickable" onClick={() => p.onTab("alteracoes")}>
          <span className="h4-inline">Alterações</span>
          <Icon name="right" size={13} />
          <span className="grow" />
          <span className="muted small">
            {(() => {
              const pending = p.edits.filter((e) => e.reviewable && (e.status === "applied" || e.status === "partial") && !e.stale).length;
              if (p.edits.length === 0) return "nenhuma edição";
              return pending ? `${pending} para revisar` : `${p.edits.length} revisada${p.edits.length > 1 ? "s" : ""}`;
            })()}
          </span>
        </button>
      </section>

      <Connectors onOpenSettings={p.onOpenSettings} />

      <Outputs messages={p.messages} onPreview={p.onPreview} onOpenFile={p.onOpenFile} />

      <Servers onOpen={() => p.onTab("tarefas")} />
    </>
  );
}

function ContextView({ conversationId, messages, streaming, onCompact }: { conversationId: string | null; messages: StoredMessage[]; streaming: boolean; onCompact: () => void }) {
  const [data, setData] = useState<{ limit: number; used: number; exact?: boolean; categories: { label: string; tokens: number }[] } | null>(null);
  useEffect(() => {
    if (!conversationId) {
      setData(null);
      return;
    }
    api.context(conversationId).then(setData).catch(() => setData(null));
  }, [conversationId, messages.length, streaming]);
  if (!conversationId) return <p className="hint">Envie uma mensagem para ver o uso de contexto.</p>;
  if (!data) return <p className="hint">Carregando…</p>;
  const pct = Math.min(100, (data.used / data.limit) * 100);
  const used = data.categories.filter((c) => c.label !== "Espaço livre");
  const free = data.categories.find((c) => c.label === "Espaço livre");
  return (
    <>
      <div className="ctx-head"><strong>{pct.toFixed(0)}% usado</strong><span className="muted">{fmtTokens(data.used)} / {fmtTokens(data.limit)}</span></div>
      <div className="ctx-bar" role="img" aria-label={`${pct.toFixed(0)}% do contexto usado`}>
        {used.map((c, i) => <span key={c.label} style={{ width: `${(c.tokens / data.limit) * 100}%`, background: CTX_COLORS[i % CTX_COLORS.length] }} />)}
      </div>
      <div className="ctx-list">
        {used.map((c, i) => (
          <div key={c.label} className="ctx-row">
            <span className="sq" style={{ background: CTX_COLORS[i % CTX_COLORS.length] }} />
            <span className="grow">{c.label}</span>
            <span className="num">{fmtTokens(c.tokens)}</span>
            <span className="num pct">{((c.tokens / data.limit) * 100).toFixed(1).replace(".", ",")}%</span>
          </div>
        ))}
        {free && (
          <div className="ctx-row">
            <span className="sq free" />
            <span className="grow">Espaço livre</span>
            <span className="num">{fmtTokens(free.tokens)}</span>
            <span className="num pct">{((free.tokens / data.limit) * 100).toFixed(1).replace(".", ",")}%</span>
          </div>
        )}
      </div>
      <div className="rrow ctx-foot">
        <span className="grow muted small" title={data.exact ? "Contado com o tokenizador do modelo carregado" : "O modelo local ainda não foi carregado; a contagem usa caracteres ÷ 4"}>{data.exact ? "Contagem exata do modelo" : "Estimativa (caracteres ÷ 4)"}</span>
        <button className="btn sm" onClick={onCompact} disabled={streaming}>Compactar sessão</button>
      </div>
    </>
  );
}

function Connectors({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [list, setList] = useState<{ name: string; tools: string[]; error?: string }[] | null>(null);
  useEffect(() => {
    api.mcp().then(setList).catch(() => setList([]));
  }, []);
  const failing = (list ?? []).filter((s) => s.error).length;
  return (
    <section className="rsec">
      <button className="rrow clickable" onClick={onOpenSettings}>
        <span className="h4-inline">Conectores</span>
        <Icon name="right" size={13} />
        <span className="grow" />
        <span className="muted small">
          {list === null ? "…" : list.length === 0 ? "nenhum" : failing ? `${failing} com erro` : `${list.length} ativo${list.length > 1 ? "s" : ""}`}
        </span>
      </button>
    </section>
  );
}

function Outputs({ messages, onPreview, onOpenFile }: { messages: StoredMessage[]; onPreview: (html: string) => void; onOpenFile: (path: string) => void }) {
  const [all, setAll] = useState(false);
  const files: string[] = [];
  for (const m of messages) {
    for (const tc of m.toolCalls ?? []) {
      if ((tc.name === "write_file" || tc.name === "edit_file") && typeof tc.args.path === "string" && !files.includes(tc.args.path)) files.unshift(tc.args.path);
    }
  }
  const pages = messages.flatMap((m) => (m.role === "assistant" ? htmlBlocks(m.content) : []));
  type Item = { key: string; label: string; icon: IconName; run: () => void };
  const items: Item[] = [
    ...files.map((f) => ({ key: f, label: f.split(/[\\/]/).pop() ?? f, icon: (/\.(md|txt)$/i.test(f) ? "doc" : "code") as IconName, run: () => onOpenFile(f) })),
    ...pages.map((html, i) => ({ key: `html-${i}`, label: /<title>(.*?)<\/title>/i.exec(html)?.[1] ?? `Página HTML ${i + 1}`, icon: "globe" as IconName, run: () => onPreview(html) })),
  ];
  const shown = all ? items : items.slice(0, 5);
  return (
    <section className="rsec">
      <h4>Saídas</h4>
      {items.length === 0 && <p className="hint">Arquivos criados ou editados e páginas HTML desta conversa aparecem aqui.</p>}
      {shown.map((it) => (
        <button key={it.key} className="rrow clickable" onClick={it.run} title={it.key}>
          <Icon name={it.icon} size={16} /><span className="grow ellipsis">{it.label}</span>
        </button>
      ))}
      {items.length > 5 && <button className="link muted-link" onClick={() => setAll(!all)}>{all ? "Mostrar menos" : "Mostrar mais"}</button>}
    </section>
  );
}

type Job = { id: string; command: string; status: string; output: string };

function Servers({ onOpen }: { onOpen: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    const load = () => api.jobs().then(setJobs).catch(() => undefined);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  const running = jobs.filter((j) => j.status === "rodando");
  return (
    <section className="rsec">
      <h4>Servidores</h4>
      <div className="rrow"><Icon name="server" size={16} /><span className="grow">zenith-code</span><span className="muted small">localhost:{location.port || "80"}</span><span className="dot ok" /></div>
      {running.map((j) => {
        const port = /localhost:(\d+)|127\.0\.0\.1:(\d+)|port\s+(\d+)/i.exec(j.output);
        return (
          <button key={j.id} className="rrow clickable" onClick={onOpen} title={j.command}>
            <Icon name="server" size={16} /><span className="grow ellipsis">{j.command}</span>
            {port && <span className="muted small">:{port[1] ?? port[2] ?? port[3]}</span>}
            <span className="dot ok" />
          </button>
        );
      })}
    </section>
  );
}

function BrowserView({ messages }: { messages: StoredMessage[] }) {
  const [url, setUrl] = useState("http://localhost:3000");
  const [src, setSrc] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const pages = messages.flatMap((m) => (m.role === "assistant" ? htmlBlocks(m.content) : []));
  const [key, setKey] = useState(0);
  function go() {
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
    setHtml(null);
    setSrc(u);
    setKey((k) => k + 1);
  }
  return (
    <div className="browser">
      <div className="browser-bar">
        <button className="icon-btn" onClick={() => setKey((k) => k + 1)} title="Recarregar" aria-label="Recarregar"><Icon name="refresh" size={15} /></button>
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} aria-label="Endereço" spellCheck={false} />
        <button className="btn sm" onClick={go}>Abrir</button>
      </div>
      {pages.length > 0 && (
        <div className="browser-pages">
          {pages.map((h, i) => (
            <button key={i} className={`chip-btn sm ${html === h ? "on" : ""}`} onClick={() => { setSrc(null); setHtml(h); setKey((k) => k + 1); }}>
              {/<title>(.*?)<\/title>/i.exec(h)?.[1] ?? `Página ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      {src || html ? (
        <iframe key={key} title="Navegador" src={src ?? undefined} srcDoc={html ?? undefined} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" />
      ) : (
        <div className="browser-empty">
          <Icon name="globe" size={28} />
          <p>Abra um servidor local (ex.: o que você iniciou em Tarefas) ou uma página HTML desta conversa.</p>
          <p className="hint">Sites externos podem bloquear a exibição dentro do app.</p>
        </div>
      )}
    </div>
  );
}

function GitView({ conversationId, streaming }: { conversationId: string | null; streaming: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.gitStatus>> | null>(null);
  const [diff, setDiff] = useState<{ path: string; text: string } | null>(null);
  const load = () => api.gitStatus(conversationId ?? undefined).then(setData).catch(() => setData(null));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, streaming]);
  if (!data) return <p className="hint">Carregando…</p>;
  if (!data.isRepo) return <p className="hint">Esta pasta não é um repositório git. Rode <code>git init</code> no terminal para acompanhar as alterações aqui.</p>;
  return (
    <>
      <div className="rrow"><Icon name="share" size={15} /> <span className="grow">{data.branch ?? "ramo desconhecido"}</span><button className="link" onClick={load}>Atualizar</button></div>
      {data.files.length === 0 && <p className="hint">Nenhuma alteração.</p>}
      {data.files.map((f) => (
        <button key={f.path + f.status} className="rrow clickable" onClick={() => openDiff(f.path)}>
          <span className={`git-st st-${f.status.trim().charAt(0)}`}>{f.status.trim()}</span>
          <span className="grow ellipsis">{f.path}</span>
        </button>
      ))}
      {diff && (
        <div className="diff-box">
          <div className="rrow"><strong className="grow ellipsis">{diff.path}</strong><button className="link" onClick={() => setDiff(null)}>Fechar</button></div>
          <pre className="diff">
            {diff.text.split("\n").map((l, i) => (
              <span key={i} className={l.startsWith("+") && !l.startsWith("+++") ? "add" : l.startsWith("-") && !l.startsWith("---") ? "del" : l.startsWith("@@") ? "hunk" : ""}>{l}{"\n"}</span>
            ))}
          </pre>
        </div>
      )}
    </>
  );

  function openDiff(path: string) {
    api.gitDiff(path, conversationId ?? undefined).then((r) => setDiff({ path, text: r.diff })).catch(() => setDiff({ path, text: "Não foi possível ler a diferença." }));
  }
}

function JobsView({ conversationId, onNotice }: { conversationId: string | null; onNotice: (m: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cmd, setCmd] = useState("");
  const load = () => api.jobs().then(setJobs).catch(() => undefined);
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);
  async function start() {
    if (!cmd.trim()) return;
    await api.startJob(cmd.trim(), conversationId ?? undefined);
    setCmd("");
    onNotice("Tarefa iniciada em segundo plano.");
    load();
  }
  return (
    <>
      <div className="rrow">
        <input className="grow" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="ex.: npm run dev" onKeyDown={(e) => e.key === "Enter" && start()} aria-label="Comando" />
        <button className="btn sm" onClick={start} disabled={!cmd.trim()}>Iniciar</button>
      </div>
      {jobs.length === 0 && <p className="hint">Nenhuma tarefa. Servidores e testes longos podem rodar aqui sem travar a conversa.</p>}
      {jobs.map((j) => (
        <div key={j.id} className="job">
          <div className="rrow">
            <span className={`dot ${j.status === "rodando" ? "ok pulse" : j.status === "concluída" ? "" : "err"}`} />
            <code className="grow ellipsis">{j.command}</code>
            <span className="muted small">{j.status}</span>
            {j.status === "rodando" && <button className="link" onClick={() => api.stopJob(j.id).then(load)}>Parar</button>}
          </div>
          {j.output && <pre className="job-out">{j.output.slice(-800)}</pre>}
        </div>
      ))}
    </>
  );
}

function FilesView({ base, openPath }: { base: string; openPath: string | null }) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<{ name: string; dir: boolean; path: string }[]>([]);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setPath("");
    setFile(null);
  }, [base]);
  useEffect(() => {
    if (openPath) api.file(openPath).then(setFile).catch((x) => setErr((x as Error).message));
  }, [openPath]);
  useEffect(() => {
    api.files(path).then((r) => { setEntries(r.entries); setErr(""); }).catch((e) => setErr((e as Error).message));
  }, [path, base]);
  return (
    <>
      {err && <div className="error">{err}</div>}
      <div className="crumbs">
        <button className="link" onClick={() => setPath("")}>{base.split(/[\\/]/).filter(Boolean).pop()}</button>
        {path.split(/[\\/]/).filter(Boolean).map((seg, i, arr) => (
          <span key={i}> / <button className="link" onClick={() => setPath(arr.slice(0, i + 1).join("/"))}>{seg}</button></span>
        ))}
      </div>
      <div className="tree-small">
        {entries.map((e) => (
          <button key={e.path} className={file?.path === e.path ? "on" : ""} onClick={() => (e.dir ? setPath(e.path) : api.file(e.path).then(setFile).catch((x) => setErr((x as Error).message)))}>
            <Icon name={e.dir ? "folder" : "doc"} size={14} /> {e.name}
          </button>
        ))}
        {entries.length === 0 && !err && <p className="hint">Pasta vazia.</p>}
      </div>
      {file && (
        <div className="file-view">
          <div className="rrow"><strong className="grow ellipsis">{file.path}</strong><button className="link" onClick={() => setFile(null)}>Fechar</button></div>
          <pre className="job-out tall">{file.content.slice(0, 8000)}</pre>
        </div>
      )}
    </>
  );
}

function Audit({ messages }: { messages: StoredMessage[] }) {
  const tools = messages.flatMap((m) => (m.toolCalls ?? []).map((t) => ({ id: t.id, name: t.name, args: t.args, at: m.createdAt })));
  if (tools.length === 0) return <p className="hint">Nenhuma ação de ferramenta nesta conversa.</p>;
  return (
    <>
      {tools.map((t) => (
        <div key={t.id} className="rrow audit-row">
          <span className="muted small">{new Date(t.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="tool-name">{t.name}</span>
          <code className="grow ellipsis">{String(t.args.path ?? t.args.command ?? t.args.query ?? t.args.url ?? "")}</code>
        </div>
      ))}
    </>
  );
}
