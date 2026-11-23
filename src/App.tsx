import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Mode as PermMode, Settings, StoredMessage, StreamEvent } from "../server/types";
import { api, streamChat, type AgentEdit, type Bootstrap, type Project } from "./api";
import { ArtifactPreview, htmlBlocks } from "./components/ArtifactPreview";
import { Composer, MODE_LABELS, type Attachment } from "./components/Composer";
import { Icon, type IconName } from "./components/Icons";
import { AssistantMessage, LiveAssistant, UserMessage, type LivePerm, type LiveTool } from "./components/Messages";
import { Palette, type PaletteAction } from "./components/Palette";
import { ProjectModal } from "./components/ProjectModal";
import { PANEL_TABS, RightPanel, type PanelTab } from "./components/RightPanel";
import { SettingsModal, type Tab as SettingsTab } from "./components/SettingsModal";
import { Sidebar, type Mode as SessionMode, type View } from "./components/Sidebar";
import { ViewRouter } from "./components/Views";

const TEXT_EXT = /\.(md|txt|csv|json|ts|tsx|js|jsx|py|html|css|yml|yaml|xml|log|sql|sh|ps1)$/i;

interface Live {
  text: string;
  tools: LiveTool[];
  perms: LivePerm[];
}
const EMPTY_LIVE: Live = { text: "", tools: [], perms: [] };

const CHAT_SUGGESTIONS: { label: string; text: string; icon: IconName }[] = [
  { label: "Escrever", text: "Me ajude a escrever um e-mail curto e educado pedindo um prazo maior.", icon: "pencil" },
  { label: "Aprender", text: "Explique de forma simples como funciona um modelo de linguagem local.", icon: "book" },
  { label: "Código", text: "Crie uma página HTML de contador com botões.", icon: "code" },
  { label: "Pesquisar", text: "Pesquise na web: notícias de IA local desta semana.", icon: "globe" },
];

const CODE_SUGGESTIONS: { label: string; text: string; icon: IconName }[] = [
  { label: "Explicar o projeto", text: "Resuma o que há nesta pasta e como o projeto está organizado.", icon: "folder" },
  { label: "Criar README", text: "Crie um README curto para este projeto.", icon: "doc" },
  { label: "Achar bugs", text: "/code-review", icon: "search" },
  { label: "Rodar testes", text: "Rode os testes do projeto e resuma o resultado.", icon: "terminal" },
];

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [sessionMode, setSessionMode] = useState<SessionMode>("chat");
  const [view, setView] = useState<View>("chat");
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>(undefined);
  const [panelTab, setPanelTab] = useState<PanelTab>("visao");
  const [prevView, setPrevView] = useState<View>("chat");
  const [showTitleMenu, setShowTitleMenu] = useState(false);
  // Histórico de navegação entre conversas (botões voltar e avançar da barra lateral).
  const [history, setHistory] = useState<{ stack: (string | null)[]; index: number }>({ stack: [null], index: 0 });
  const navFromHistory = useRef(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  // Ferramentas ligadas ou desligadas por conversa, guardadas neste navegador.
  const FLAGS_DEFAULT = { web: true, mcp: true, skills: true, exec: true };
  const [flagsMap, setFlagsMap] = useState<Record<string, typeof FLAGS_DEFAULT>>(() => {
    try {
      return JSON.parse(localStorage.getItem("zenith-flags") ?? "{}");
    } catch {
      return {};
    }
  });
  const flagsKey = activeId ?? "rascunho";
  const toolFlags = flagsMap[flagsKey] ?? FLAGS_DEFAULT;
  const setToolFlags = (f: typeof FLAGS_DEFAULT) =>
    setFlagsMap((m) => {
      const next = { ...m, [flagsKey]: f };
      localStorage.setItem("zenith-flags", JSON.stringify(next));
      return next;
    });
  const search = "";
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState("");
  const [runtime, setRuntime] = useState<{ gpu: string | false; loaded: boolean } | null>(null);
  const [permMode, setPermMode] = useState<PermMode>("ask");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [draftFolder, setDraftFolder] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"claro" | "escuro">(() => (localStorage.getItem("zenith-theme") === "claro" ? "claro" : "escuro"));
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "escuro" ? "dark" : "light";
    localStorage.setItem("zenith-theme", theme);
  }, [theme]);

  useEffect(() => {
    api.bootstrap().then((b) => {
      setBoot(b);
      setSettings(b.settings);
      setConversations(b.conversations);
      setProviderId(b.settings.defaultProvider);
      setModel(b.settings.defaultModel);
      setPermMode(b.settings.mode);
    }).catch((e) => setError((e as Error).message));
    api.projects().then(setProjects).catch(() => undefined);
    api.runtime().then(setRuntime).catch(() => undefined);
    api.feedback().then(setFeedbackMap).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!providerId) return;
    setModelError("");
    api.models(providerId).then((r) => {
      setModels(r.models);
      if (r.error) setModelError(r.error);
      setModel((current) => (current && r.models.includes(current) ? current : r.models[0] ?? current));
    }).catch((e) => setModelError((e as Error).message));
  }, [providerId]);

  useEffect(() => {
    if (navFromHistory.current) {
      navFromHistory.current = false;
    } else {
      setHistory((h) => (h.stack[h.index] === activeId ? h : { stack: [...h.stack.slice(0, h.index + 1), activeId], index: h.index + 1 }));
    }
    if (!activeId) {
      setMessages([]);
      return;
    }
    api.getConversation(activeId).then((r) => {
      setMessages(r.messages);
      setSessionMode((r.conversation.kind ?? "chat") as SessionMode);
    }).catch((e) => setError((e as Error).message));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live]);

  useEffect(() => {
    if (view === "projects") api.projects().then(setProjects).catch(() => undefined);
  }, [view]);

  // Edições do agente nesta conversa (revisão por arquivo e por trecho).
  const [edits, setEdits] = useState<AgentEdit[]>([]);
  const loadEdits = () => {
    if (!activeId) {
      setEdits([]);
      return;
    }
    api.edits(activeId).then(setEdits).catch(() => setEdits([]));
  };
  useEffect(loadEdits, [activeId, messages.length, streaming]);

  // Porcentagem do contexto usada, para o círculo ao lado do modo de permissão.
  const [ctxPct, setCtxPct] = useState<number | null>(0);
  useEffect(() => {
    if (!activeId) {
      setCtxPct(0);
      return;
    }
    api.context(activeId).then((d) => setCtxPct((d.used / d.limit) * 100)).catch(() => setCtxPct(null));
  }, [activeId, messages.length, streaming]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "k") { e.preventDefault(); setShowPalette(true); }
      else if (mod && k === "n") { e.preventDefault(); newSession(); }
      else if (mod && k === "b") { e.preventDefault(); setCollapsed((v) => !v); }
      else if (mod && k === "j") { e.preventDefault(); setPanelOpen((v) => !v); }
      else if (mod && e.key === ",") { e.preventDefault(); setView("settings"); }
      else if (e.key === "Escape") { setShowPalette(false); setShowMenu(false); setShowTitleMenu(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const activeConversation = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  const folderOfActive = activeConversation ? activeConversation.folder ?? "" : draftFolder;
  const tokenEstimate = useMemo(() => Math.round((messages.reduce((n, m) => n + m.content.length, 0) + live.text.length) / 4), [messages, live.text]);
  const visibleConversations = conversations;

  async function refreshConversations() {
    setConversations(await api.conversations());
  }

  async function refreshProjects() {
    setProjects(await api.projects());
  }

  /** Pede uma pasta ao usuário: diálogo nativo no Windows, ou digitação como alternativa. */
  async function chooseFolder(): Promise<string | null> {
    const r = await api.pickFolder();
    if (r.path) return r.path;
    if (r.error) {
      const typed = window.prompt("Caminho da pasta (ex.: E:\\projetos\\meu-app)");
      return typed && typed.trim() ? typed.trim() : null;
    }
    return null;
  }

  async function createSession(kind: SessionMode, folder: string | null, title: string): Promise<string> {
    const conv = await api.createConversation(title, kind, folder);
    setConversations((list) => [conv, ...list]);
    setActiveId(conv.id);
    setMessages([]);
    setLive(EMPTY_LIVE);
    setEditingId(null);
    setSessionMode(kind);
    setView("chat");
    return conv.id;
  }

  /** Botão "Nova": chat abre direto; cowork e code pedem a pasta antes. */
  async function newSession() {
    if (streaming) return;
    // A conversa só é criada no primeiro envio; até lá fica um rascunho com a tela inicial.
    if (sessionMode === "code") {
      const folder = await chooseFolder();
      if (!folder) return;
      setDraftFolder(folder);
    } else {
      setDraftFolder("");
    }
    setActiveId(null);
    setMessages([]);
    setLive(EMPTY_LIVE);
    setEditingId(null);
    setInput("");
    setView("chat");
  }

  function changeMode(m: SessionMode) {
    setSessionMode(m);
    setView("chat");
    if (activeConversation && (activeConversation.kind === "code") !== (m === "code")) setActiveId(null);
    setPanelTab("visao");
  }

  async function setFolder(folder: string | null) {
    if (activeId) {
      await api.updateConversation(activeId, { folder });
      await refreshConversations();
    } else {
      setDraftFolder(folder ?? "");
    }
  }

  async function pickFolderForChat() {
    const folder = await chooseFolder();
    if (folder) await setFolder(folder);
  }

  function goHistory(delta: number) {
    const index = history.index + delta;
    if (index < 0 || index >= history.stack.length) return;
    const target = history.stack[index];
    if (target && !conversations.some((c) => c.id === target)) {
      // Conversa apagada: remove do histórico e tenta de novo.
      setHistory((h) => ({ stack: h.stack.filter((_, i) => i !== index), index: Math.min(h.index, h.stack.length - 2) }));
      return;
    }
    navFromHistory.current = true;
    setHistory({ ...history, index });
    setActiveId(target);
    setView("chat");
  }

  function openPanel(tab: PanelTab) {
    if (panelOpen && panelTab === tab) setPanelOpen(false);
    else {
      setPanelTab(tab);
      setPanelOpen(true);
    }
  }

  async function deleteConversation(id: string) {
    const c = conversations.find((x) => x.id === id);
    if (!window.confirm(`Excluir a conversa "${c?.title ?? ""}"? Isso não pode ser desfeito.`)) return;
    await api.deleteConversation(id);
    if (activeId === id) setActiveId(null);
    await refreshConversations();
  }

  async function togglePin(c: Conversation) {
    await api.updateConversation(c.id, { pinned: !c.pinned });
    await refreshConversations();
  }

  async function renameConversation(c: Conversation) {
    const title = window.prompt("Novo título", c.title);
    if (!title || !title.trim()) return;
    await api.updateConversation(c.id, { title: title.trim() });
    await refreshConversations();
  }

  async function createProject() {
    const name = window.prompt("Nome do projeto");
    if (!name || !name.trim()) return;
    const folder = await chooseFolder();
    const p = await api.createProject(name.trim(), "", folder);
    await refreshProjects();
    setEditProject(p);
  }

  async function newChatInFolder(folder: string | null, projectId?: string) {
    setSessionMode("chat");
    setView("chat");
    const project = projects.find((p) => p.id === projectId);
    const id = await createSession("chat", folder, project ? `Conversa em ${project.name}` : "Nova conversa");
    if (projectId) {
      await api.updateConversation(id, { projectId });
      await refreshConversations();
    }
  }

  function applyEvent(e: StreamEvent) {
    setLive((prev) => {
      switch (e.type) {
        case "delta":
          return { ...prev, text: prev.text + e.text };
        case "tool_start":
          return { ...prev, tools: [...prev.tools, { id: e.id, name: e.name, args: e.args, status: "running" }] };
        case "tool_result":
          return { ...prev, tools: prev.tools.map((t) => (t.id === e.id ? { ...t, status: e.ok ? "ok" : "error", output: e.output } : t)) };
        case "permission":
          return { ...prev, perms: [...prev.perms, { id: e.id, name: e.name, risk: e.risk, summary: e.summary }] };
        case "error":
          setError(e.message);
          return prev;
        default:
          return prev;
      }
    });
  }

  async function send(text?: string, opts?: { regenerate?: boolean }) {
    let content = (text ?? input).trim();
    if ((!content && attachments.length === 0) || streaming || !settings) return;
    if (attachments.length) {
      const blocks = attachments.map((a) => `Arquivo anexado: ${a.name}\n\`\`\`\n${a.content}\n\`\`\``).join("\n\n");
      content = `${blocks}\n\n${content}`.trim();
    }
    const visibleText = (text ?? input).trim();
    setError("");
    if (!opts?.regenerate) setInput("");
    setAttachments([]);
    let convId = activeId;
    if (editingId && convId) {
      await api.truncate(convId, editingId);
      setEditingId(null);
    }
    if (!convId) {
      convId = await createSession(sessionMode, sessionMode === "chat" ? (draftFolder || null) : draftFolder || null, visibleText.slice(0, 60) || "Nova conversa");
      await api.updateConversation(convId, { title: visibleText.slice(0, 60) || "Nova conversa" });
      await refreshConversations();
    } else if (messages.length === 0 && /^(Nova (conversa|sessão)|Conversa em )/.test(activeConversation?.title ?? "") && visibleText) {
      await api.updateConversation(convId, { title: visibleText.slice(0, 60) });
      await refreshConversations();
    }
    if (!opts?.regenerate) {
      setMessages((m) => {
        const kept = editingId ? m.slice(0, m.findIndex((x) => x.id === editingId)) : m;
        return [...kept, { id: `tmp-${Date.now()}`, role: "user", content, createdAt: Date.now() }];
      });
    }
    setLive(EMPTY_LIVE);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({ conversationId: convId, text: content, providerId, model, mode: permMode, toolFlags }, applyEvent, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setLive(EMPTY_LIVE);
      const r = await api.getConversation(convId);
      setMessages(r.messages);
      await refreshConversations();
      api.runtime().then(setRuntime).catch(() => undefined);
    }
  }

  async function regenerateLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || !activeId) return;
    await api.truncate(activeId, lastUser.id);
    const text = lastUser.content;
    setMessages((m) => m.slice(0, m.findIndex((x) => x.id === lastUser.id)));
    send(text, { regenerate: true });
  }

  function startEdit(m: StoredMessage) {
    setEditingId(m.id);
    setInput(m.content);
  }

  async function undoLast() {
    try {
      const r = await api.undo();
      setNotice(r.message);
    } catch (e) {
      setNotice((e as Error).message);
    }
    setTimeout(() => setNotice(""), 5000);
  }

  async function answer(permId: string, decision: "once" | "always" | "deny") {
    setLive((prev) => ({ ...prev, perms: prev.perms.map((p) => (p.id === permId ? { ...p, answered: decision } : p)) }));
    await api.permission(permId, decision);
  }

  async function onAttachFiles(files: FileList | null) {
    if (!files) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!TEXT_EXT.test(f.name)) {
        setError(`Formato não suportado nesta versão: ${f.name}. Use arquivos de texto.`);
        continue;
      }
      if (f.size > 300_000) {
        setError(`${f.name} é grande demais para anexar (limite de 300 KB).`);
        continue;
      }
      added.push({ name: f.name, content: await f.text() });
    }
    setAttachments((a) => [...a, ...added]);
  }

  if (!settings) {
    return <div className="boot">{error ? `Erro ao iniciar: ${error}` : "Iniciando Zenith…"}</div>;
  }

  const skills = boot?.skills ?? [];
  const inChat = view === "chat";
  const showWelcome = inChat && messages.length === 0 && !streaming;
  const folderPath = folderOfActive || settings.workspace;
  const toolResults: Record<string, string> = {};
  for (const m of messages) if (m.role === "tool" && m.toolCallId) toolResults[m.toolCallId] = m.content;
  const lastAssistantId = [...messages].reverse().find((x) => x.role === "assistant" && x.content)?.id;
  const viewTitle: Record<View, string> = { chat: "", projects: "Projetos", settings: "Configurações", automations: "Agendados", agents: "Agentes", artifacts: "Artefatos" };
  const title = inChat ? activeConversation?.title ?? (sessionMode === "chat" ? "Nova conversa" : "Nova sessão de código") : viewTitle[view];

  const openSettings = (tab?: SettingsTab) => { setSettingsTab(tab); if (view !== "settings") setPrevView(view); setView("settings"); };

  const paletteActions: PaletteAction[] = [
    { id: "new", label: "Nova conversa", icon: "plus", hint: "Ctrl+N", run: () => { changeMode("chat"); newSession(); } },
    { id: "code", label: "Nova sessão de código (pede pasta)", icon: "code", run: () => { changeMode("code"); newSession(); } },
    { id: "settings", label: "Configurações", icon: "settings", hint: "Ctrl+,", run: () => openSettings() },
    { id: "projects", label: "Projetos", icon: "folder", run: () => setView("projects") },
    { id: "artifacts", label: "Artefatos", icon: "artifacts", run: () => setView("artifacts") },
    { id: "automations", label: "Agendados", icon: "clock", run: () => setView("automations") },
    { id: "plugins", label: "Plugins", icon: "puzzle", run: () => openSettings("plugins") },
    { id: "panel", label: "Mostrar ou ocultar painel", icon: "panel", hint: "Ctrl+J", run: () => setPanelOpen((v) => !v) },
    { id: "terminal", label: "Abrir terminal", icon: "terminal", run: () => openPanel("terminal") },
    { id: "theme", label: theme === "escuro" ? "Usar tema claro" : "Usar tema escuro", icon: "moon", run: () => setTheme(theme === "escuro" ? "claro" : "escuro") },
    { id: "undo", label: "Desfazer última alteração de arquivo", icon: "refresh", run: undoLast },
  ];

  const composerProps = {
    value: input,
    onChange: setInput,
    onSend: () => send(),
    onStop: () => abortRef.current?.abort(),
    streaming,
    attachments,
    onAttachFiles,
    onRemoveAttachment: (i: number) => setAttachments((list) => list.filter((_, j) => j !== i)),
    providers: settings.providers,
    providerId,
    onProvider: setProviderId,
    models,
    model,
    onModel: setModel,
    mode: permMode,
    onMode: setPermMode,
    folder: folderOfActive,
    onPickFolder: pickFolderForChat,
    toolFlags,
    onToolFlags: setToolFlags,
    skills,
    contextPct: ctxPct,
    onContext: () => openPanel("visao"),
    onOpenView: (v: "projects" | "settings") => setView(v),
    onToast: setToast,
  };

  // Ícones do topo à direita: no modo Code, atalhos para cada parte do painel.
  const codeTools = PANEL_TABS.filter((t) => ["visao", "terminal", "tarefas", "navegador", "arquivos"].includes(t.id));

  return (
    <div className={`app ${collapsed || view === "settings" ? "collapsed" : ""}`}>
      <Sidebar
        mode={sessionMode}
        onMode={changeMode}
        view={view}
        conversations={conversations}
        projects={projects}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); setView("chat"); }}
        onNew={newSession}
        onNav={(a) => {
          if (a === "new") newSession();
          else if (a === "search") setShowPalette(true);
          else if (a === "projects") setView("projects");
          else if (a === "artifacts") setView("artifacts");
          else if (a === "automations") setView("automations");
          else if (a === "plugins") openSettings("plugins");
        }}
        onRename={renameConversation}
        onPin={togglePin}
        onDelete={deleteConversation}
        onSettings={() => openSettings()}
        onCollapse={() => setCollapsed(true)}
        onBack={() => goHistory(-1)}
        onForward={() => goHistory(1)}
        canBack={history.index > 0}
        canForward={history.index < history.stack.length - 1}
        theme={theme}
        onTheme={setTheme}
        onShortcuts={() => openSettings("atalhos")}
        disabled={streaming}
      />

      <main className="main">
        <div className="center">
          {view !== "settings" && (
            <header className="topbar">
              {collapsed && (
                <button className="icon-btn" onClick={() => setCollapsed(false)} title="Mostrar barra lateral (Ctrl+B)" aria-label="Mostrar barra lateral"><Icon name="sidebar" size={16} /></button>
              )}
              <div className="title-wrap">
                {inChat && activeConversation ? (
                  <div className="menu-wrap">
                    <button className="title-btn" onClick={() => setShowTitleMenu((v) => !v)} aria-expanded={showTitleMenu} title="Opções da conversa">
                      <span className="ellipsis">{title}</span> <Icon name="chevron" size={14} />
                    </button>
                    {showTitleMenu && (
                      <>
                        <div className="click-away" onClick={() => setShowTitleMenu(false)} />
                        <div className="menu left">
                          <button onClick={() => { setShowTitleMenu(false); togglePin(activeConversation); }}><Icon name="pin" size={15} /> {activeConversation.pinned ? "Desafixar" : "Fixar"}</button>
                          <button onClick={() => { setShowTitleMenu(false); renameConversation(activeConversation); }}><Icon name="pencil" size={15} /> Renomear</button>
                          <button onClick={() => { setShowTitleMenu(false); pickFolderForChat(); }}><Icon name="folder" size={15} /> Trocar pasta de trabalho</button>
                          <div className="menu-label">Projeto</div>
                          <select value={activeConversation.projectId ?? ""} onChange={(e) => api.updateConversation(activeConversation.id, { projectId: e.target.value || null }).then(refreshConversations)} aria-label="Projeto da conversa">
                            <option value="">Sem projeto</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className="sep" />
                          <button onClick={() => { setShowTitleMenu(false); undoLast(); }}><Icon name="refresh" size={15} /> Desfazer última alteração de arquivo</button>
                          <button className="danger" onClick={() => { setShowTitleMenu(false); deleteConversation(activeConversation.id); }}><Icon name="trash" size={15} /> Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="title-text">{title}</div>
                )}
                {inChat && (
                  <button className="icon-btn env-btn" onClick={() => openPanel("visao")} title={`Este computador · ${folderPath}`} aria-label="Ambiente">
                    <Icon name="laptop" size={16} /><span className="env-dot" />
                  </button>
                )}
              </div>

              {inChat && (
                <div className="right">
                  {sessionMode === "code" ? (
                    <>
                      {codeTools.map((t) => (
                        <button key={t.id} className={`icon-btn ${panelOpen && panelTab === t.id ? "on" : ""}`} onClick={() => openPanel(t.id)} title={t.label} aria-label={t.label}><Icon name={t.icon} size={16} /></button>
                      ))}
                      <div className="menu-wrap">
                        <button className="icon-btn" onClick={() => setShowMenu((v) => !v)} title="Mais" aria-label="Mais"><Icon name="more" size={16} /></button>
                        {showMenu && (
                          <>
                            <div className="click-away" onClick={() => setShowMenu(false)} />
                            <div className="menu">
                              <button onClick={() => { setShowMenu(false); openPanel("alteracoes"); }}><Icon name="share" size={15} /> Alterações (git)</button>
                              <button onClick={() => { setShowMenu(false); openPanel("auditoria"); }}><Icon name="shield" size={15} /> Auditoria</button>
                              {activeId && <a href={api.exportUrl(activeId, "md")} onClick={() => setShowMenu(false)}><Icon name="doc" size={15} /> Exportar em Markdown</a>}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <button className={`icon-btn ${panelOpen && panelTab === "navegador" ? "on" : ""}`} onClick={() => openPanel("navegador")} title="Navegador" aria-label="Navegador"><Icon name="globe" size={16} /></button>
                      <button className={`icon-btn ${panelOpen && panelTab === "visao" ? "on" : ""}`} onClick={() => openPanel("visao")} title="Painel (Ctrl+J)" aria-label="Painel"><Icon name="list" size={16} /></button>
                      {activeId && (
                        <div className="menu-wrap">
                          <button className="share-btn" onClick={() => setShowMenu((v) => !v)}><Icon name="share" size={15} /> Compartilhar</button>
                          {showMenu && (
                            <>
                              <div className="click-away" onClick={() => setShowMenu(false)} />
                              <div className="menu">
                                <div className="menu-label">Sem nuvem: exporte e envie o arquivo</div>
                                <a href={api.exportUrl(activeId, "md")} onClick={() => setShowMenu(false)}><Icon name="doc" size={15} /> Exportar em Markdown</a>
                                <a href={api.exportUrl(activeId, "json")} onClick={() => setShowMenu(false)}><Icon name="code" size={15} /> Exportar em JSON</a>
                                <button onClick={() => {
                                  setShowMenu(false);
                                  const text = messages.filter((m) => m.role !== "tool" && m.content).map((m) => `${m.role === "user" ? "Você" : "Zenith"}:\n${m.content}`).join("\n\n");
                                  navigator.clipboard?.writeText(text).then(() => setToast("Conversa copiada.")).catch(() => setToast("Não foi possível copiar."));
                                }}><Icon name="copy" size={15} /> Copiar conversa</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </header>
          )}

          {modelError && <div className="banner warn">{modelError}</div>}
          {notice && <div className="banner info">{notice}</div>}
          {permMode === "bypass" && inChat && <div className="banner danger">Modo sem aprovação: ferramentas rodam sem perguntar.</div>}

          {view === "settings" && (
            <SettingsModal
              key={settingsTab ?? "geral"}
              page
              settings={settings}
              skills={skills}
              hooks={boot?.hooks ?? {}}
              theme={theme}
              onTheme={setTheme}
              initialTab={settingsTab}
              onSaved={(s) => { setSettings(s); setPermMode(s.mode); setToast("Configurações salvas."); }}
              onClose={() => setView(prevView)}
            />
          )}

          {view !== "settings" && !inChat && (
            <ViewRouter
              view={view as "projects" | "automations" | "agents" | "artifacts"}
              projects={projects}
              conversations={conversations}
              onNewProject={createProject}
              onEditProject={setEditProject}
              onOpenFolderChat={(folder, projectId) => newChatInFolder(folder, projectId)}
              onOpenChat={(id) => { refreshConversations(); setActiveId(id); setView("chat"); }}
              onPreview={setPreview}
              onToast={setToast}
            />
          )}

          {inChat && (
            showWelcome ? (
              <div className="welcome">
                <div className="welcome-title">
                  <ZenithMark />
                  <h1>{sessionMode === "chat" ? "Como posso ajudar hoje?" : "Qual é a tarefa de código?"}</h1>
                </div>
                {sessionMode === "code" && (
                  <button className="folder-pick" onClick={pickFolderForChat}>
                    <Icon name="folder" size={15} /> {shortName(folderPath)} <span className="muted">· trocar pasta</span>
                  </button>
                )}
                <Composer big {...composerProps} editing={false} onCancelEdit={() => undefined} placeholder={sessionMode === "chat" ? "Como posso ajudar?" : "Descreva a tarefa. O agente trabalha na pasta escolhida."} />
                <div className="chips-row">
                  {(sessionMode === "chat" ? CHAT_SUGGESTIONS : CODE_SUGGESTIONS).map((s) => (
                    <button key={s.text} className="chip-btn" onClick={() => send(s.text)}><Icon name={s.icon} size={15} /> {s.label}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="thread">
                  <div className="thread-inner">
                    {messages.map((m) => {
                      if (m.role === "user") return <UserMessage key={m.id} m={m} onEdit={startEdit} disabled={streaming} />;
                      if (m.role === "tool") return null;
                      return (
                        <AssistantMessage
                          key={m.id}
                          m={m}
                          results={toolResults}
                          edits={edits.filter((e) => e.toolCallId && (m.toolCalls ?? []).some((t) => t.id === e.toolCallId))}
                          onEditsChanged={loadEdits}
                          onNotice={setToast}
                          isLast={m.id === lastAssistantId && !streaming}
                          onPreview={setPreview}
                          onRegenerate={m.id === lastAssistantId ? regenerateLast : undefined}
                          disabled={streaming}
                          feedback={feedbackMap[m.id]}
                          onFeedback={(v) => api.setFeedback(m.id, v).then(setFeedbackMap).catch(() => undefined)}
                        />
                      );
                    })}
                    {streaming && <LiveAssistant text={live.text} tools={live.tools} perms={live.perms} onAnswer={answer} />}
                    <div ref={bottomRef} />
                  </div>
                </div>
                {error && <div className="banner danger" onClick={() => setError("")} role="button" title="Clique para fechar">{error}</div>}
                {ctxPct !== null && ctxPct >= 85 && !streaming && (
                  <div className="banner warn ctx-warn">
                    <span className="grow">Contexto {ctxPct >= 100 ? "cheio" : "quase cheio"} ({Math.round(ctxPct)}%). As mensagens mais antigas deixam de caber. Compacte a sessão para resumir o início e continuar.</span>
                    <button className="btn sm" onClick={() => send("/compact")}>Compactar sessão</button>
                  </div>
                )}
                <Composer {...composerProps} editing={!!editingId} onCancelEdit={() => { setEditingId(null); setInput(""); }} />
              </>
            )
          )}
        </div>

        {panelOpen && inChat && (
          <RightPanel
            tab={panelTab}
            onTab={setPanelTab}
            conversationId={activeId}
            folder={folderOfActive}
            workspace={settings.workspace}
            messages={messages}
            streaming={streaming}
            permMode={permMode}
            onPreview={setPreview}
            onPickFolder={pickFolderForChat}
            onCompact={() => send("/compact")}
            onClose={() => setPanelOpen(false)}
            onNotice={setToast}
            onOpenSettings={() => openSettings("mcp")}
            edits={edits}
            onEditsChanged={loadEdits}
          />
        )}
      </main>

      {showPalette && <Palette actions={paletteActions} conversations={conversations} onOpenChat={(id) => { setActiveId(id); setView("chat"); }} onClose={() => setShowPalette(false)} />}
      {editProject && (
        <ProjectModal
          project={editProject}
          onChanged={refreshProjects}
          onDeleted={() => { setEditProject(null); refreshProjects(); }}
          onClose={() => setEditProject(null)}
        />
      )}
      {preview && <ArtifactPreview html={preview} onClose={() => setPreview(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/** Marca do Zenith: estrela de quatro pontas com um ponto no centro (desenho próprio). */
function ZenithMark() {
  return (
    <svg className="zenith-mark" width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c1 7 3.5 11 14 14-10.5 3-13 7-14 14-1-7-3.5-11-14-14C12.5 13 15 9 16 2z" fill="var(--accent)" />
      <circle cx="16" cy="16" r="2.4" fill="var(--bg)" />
    </svg>
  );
}

function shortName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

export { MODE_LABELS, htmlBlocks };
