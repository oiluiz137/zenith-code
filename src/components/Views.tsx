import { useEffect, useState, type ReactNode } from "react";
import type { Conversation } from "../../server/types";
import { api, type Project, type ScheduledTask } from "../api";
import { Icon } from "./Icons";
import { htmlBlocks } from "./ArtifactPreview";
import { askConfirm } from "./Dialogs";

interface Props {
  view: "projects" | "automations" | "agents" | "artifacts";
  projects: Project[];
  conversations: Conversation[];
  onNewProject: () => void;
  onEditProject: (p: Project) => void;
  onOpenFolderChat: (folder: string | null, projectId?: string) => void;
  onOpenChat: (id: string) => void;
  onPreview: (html: string) => void;
  onToast: (msg: string) => void;
}

function Header({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="view-head">
      <div className="grow">
        <h2>{title}</h2>
        <p className="sub">{sub}</p>
      </div>
      {action}
    </div>
  );
}

export function ViewRouter(p: Props) {
  return (
    <div className="view">
      <div className="view-inner">
        {p.view === "projects" && <ProjectsView {...p} />}
        {p.view === "automations" && <AutomationsView {...p} />}
        {p.view === "artifacts" && <ArtifactsView {...p} />}
        {p.view === "agents" && <AgentsView />}
      </div>
    </div>
  );
}

function ProjectsView(p: Props) {
  const [q, setQ] = useState("");
  const list = p.projects.filter((pr) => pr.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Header title="Projetos" sub="Uma pasta, instruções e arquivos de referência. Conversas dentro do projeto usam a pasta dele." action={<button className="btn primary" onClick={p.onNewProject}><Icon name="plus" size={16} /> Novo projeto</button>} />
      {p.projects.length > 0 && (
        <div className="search-field"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar projetos" aria-label="Procurar projetos" /></div>
      )}
      {p.projects.length === 0 && (
        <div className="empty-state">
          <Icon name="folder" size={30} />
          <p>Nenhum projeto ainda.</p>
          <p className="hint">Crie um para guardar instruções e uma pasta de trabalho.</p>
        </div>
      )}
      <div className="grid">
        {list.map((pr) => {
          const count = p.conversations.filter((c) => c.projectId === pr.id).length;
          return (
            <div key={pr.id} className="card clickable" onClick={() => p.onEditProject(pr)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && p.onEditProject(pr)}>
              <h3>{pr.name}</h3>
              <p className="ellipsis2">{pr.instructions ? pr.instructions.slice(0, 160) : "Sem instruções ainda."}</p>
              <div className="card-meta">
                <span><Icon name="folder" size={13} /> {pr.folder ? pr.folder.split(/[\\/]/).filter(Boolean).pop() : "sem pasta"}</span>
                <span>{count} conversa{count === 1 ? "" : "s"}</span>
              </div>
              <div className="actions">
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); p.onOpenFolderChat(pr.folder ?? null, pr.id); }}>Nova conversa</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ArtifactsView(p: Props) {
  const [items, setItems] = useState<{ conversationId: string; title: string; messageId: string; html: string; name: string; createdAt: number }[] | null>(null);
  useEffect(() => {
    api.artifacts().then((rows) => {
      setItems(rows.flatMap((r) => htmlBlocks(r.content).map((html, i) => ({
        conversationId: r.conversationId,
        title: r.title,
        messageId: `${r.messageId}-${i}`,
        html,
        name: /<title>(.*?)<\/title>/i.exec(html)?.[1] ?? r.title,
        createdAt: r.createdAt,
      }))));
    }).catch(() => setItems([]));
  }, []);
  return (
    <>
      <Header title="Artefatos" sub="Páginas HTML criadas nas suas conversas. Abra para ver funcionando ou volte à conversa de origem." />
      {items === null && <p className="hint">Carregando…</p>}
      {items?.length === 0 && (
        <div className="empty-state">
          <Icon name="artifacts" size={30} />
          <p>Nenhum artefato ainda.</p>
          <p className="hint">Peça no chat algo como “crie uma página HTML de contador”.</p>
        </div>
      )}
      <div className="grid">
        {items?.map((a) => (
          <div key={a.messageId} className="card artifact">
            <div className="thumb" onClick={() => p.onPreview(a.html)} role="button" tabIndex={0} aria-label={`Abrir ${a.name}`}>
              <iframe title={a.name} srcDoc={a.html} sandbox="" tabIndex={-1} />
            </div>
            <h3 className="ellipsis">{a.name}</h3>
            <p className="ellipsis">{a.title} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
            <div className="actions">
              <button className="btn sm" onClick={() => p.onPreview(a.html)}>Abrir</button>
              <button className="btn sm ghost" onClick={() => p.onOpenChat(a.conversationId)}>Ver conversa</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const REPEAT_LABEL: Record<ScheduledTask["repeat"], string> = { once: "Uma vez", hourly: "A cada hora", daily: "Todo dia", weekly: "Toda semana" };

function fmtWhen(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function AutomationsView(p: Props) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [form, setForm] = useState<{ title: string; prompt: string; repeat: ScheduledTask["repeat"]; time: string } | null>(null);
  const [err, setErr] = useState("");
  const load = () => api.schedules().then((t) => { setTasks(t); setErr(""); }).catch(() => setErr("Não foi possível falar com o servidor do Zenith. Tentando de novo…"));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function save() {
    if (!form) return;
    try {
      await api.createSchedule({ ...form, mode: "plan" });
      setForm(null);
      setErr("");
      p.onToast("Tarefa agendada.");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <Header
        title="Agendados"
        sub="Pedidos que rodam sozinhos no horário escolhido, cada um numa conversa nova. Rodam em modo Plano (só leitura) e só enquanto o Zenith está aberto."
        action={!form && <button className="btn primary" onClick={() => setForm({ title: "", prompt: "", repeat: "daily", time: "09:00" })}><Icon name="plus" size={16} /> Nova tarefa</button>}
      />
      {err && <div className="error">{err}</div>}
      {form && (
        <div className="card form-card">
          <label className="field"><span>Nome</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex.: Resumo das notícias de IA" /></label>
          <label className="field"><span>Pedido</span><textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="O que o Zenith deve fazer" /></label>
          <div className="grid2">
            <label className="field"><span>Repetição</span>
              <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as ScheduledTask["repeat"] })}>
                {Object.entries(REPEAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>{form.repeat === "hourly" ? "Minuto (HH:MM, usa só os minutos)" : "Horário"}</span><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={save} disabled={!form.prompt.trim()}>Agendar</button>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {tasks.length === 0 && !form && (
        <div className="empty-state">
          <Icon name="calendar" size={30} />
          <p>Nenhuma tarefa agendada.</p>
          <p className="hint">Exemplo: todo dia às 9h, “resuma o que mudou na pasta do projeto”.</p>
        </div>
      )}
      {tasks.length > 0 && (
        <div className="row-list">
          {tasks.map((t) => (
            <div key={t.id}>
              <button className={`switch ${t.enabled ? "on" : ""}`} onClick={() => api.updateSchedule(t.id, { enabled: !t.enabled }).then(load)} role="switch" aria-checked={t.enabled} aria-label={t.enabled ? "Desativar" : "Ativar"} />
              <div className="grow">
                <div className="row-title">{t.title}</div>
                <small>{REPEAT_LABEL[t.repeat]}{t.repeat !== "hourly" ? ` às ${t.time}` : ` no minuto ${t.time.split(":")[1]}`} · próxima: {t.enabled ? fmtWhen(t.nextRun) : "pausada"} · última: {fmtWhen(t.lastRun)}{t.lastStatus ? ` (${t.lastStatus})` : ""}</small>
              </div>
              {t.lastConversationId && <button className="btn sm ghost" onClick={() => p.onOpenChat(t.lastConversationId!)}>Ver resultado</button>}
              <button className="btn sm" onClick={() => api.runSchedule(t.id).then(() => { p.onToast("Executando agora…"); setTimeout(load, 800); })} disabled={t.lastStatus === "executando"}>
                <Icon name="play" size={13} /> Executar
              </button>
              <button className="icon-btn" onClick={async () => { if (await askConfirm({ title: "Excluir tarefa", message: `Excluir a tarefa "${t.title}"?`, confirm: "Excluir", danger: true })) api.deleteSchedule(t.id).then(load); }} title="Excluir" aria-label="Excluir"><Icon name="trash" size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AgentsView() {
  return (
    <>
      <Header title="Equipe de agentes" sub="Várias sessões de agente trabalhando em paralelo, com tarefas e mensagens compartilhadas." />
      <div className="empty-state">Em breve (passo 21 do plano). Por enquanto, use subagentes pelo chat com a skill subagent-driven-development.</div>
    </>
  );
}
