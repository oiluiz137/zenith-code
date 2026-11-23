import { useEffect, useRef, useState } from "react";
import type { Conversation } from "../../server/types";
import type { Project } from "../api";
import { Icon, type IconName } from "./Icons";

export type Mode = "chat" | "code";
export type View = "chat" | "projects" | "settings" | "automations" | "agents" | "artifacts";

type NavAction = "new" | "search" | "projects" | "artifacts" | "automations" | "plugins";

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  view: View;
  conversations: Conversation[];
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNav: (a: NavAction) => void;
  onRename: (c: Conversation) => void;
  onPin: (c: Conversation) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  onCollapse: () => void;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
  theme: "claro" | "escuro";
  onTheme: (t: "claro" | "escuro") => void;
  onShortcuts: () => void;
  disabled: boolean;
}

/** Sessões de código agrupadas pela pasta de trabalho. */
function byFolder(list: Conversation[]): [string, Conversation[]][] {
  const map = new Map<string, Conversation[]>();
  for (const c of list) {
    const key = c.folder ? c.folder.split(/[\\/]/).filter(Boolean).pop() ?? c.folder : "Sem pasta";
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return [...map.entries()];
}

/**
 * Barra lateral: navegação no alto e lista de conversas embaixo.
 * Topo: recolher, voltar, avançar e os dois ícones de modo. Rodapé: perfil local.
 */
export function Sidebar(p: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const footRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e: MouseEvent) => {
      if (footRef.current && !footRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileOpen]);

  // Conversas vazias (sem nenhuma mensagem) ficam ocultas, exceto a que está aberta.
  const visible = p.conversations.filter((c) => (c.messageCount ?? 1) > 0 || c.id === p.activeId);
  const chatList = visible.filter((c) => (c.kind ?? "chat") !== "code");
  const codeList = visible.filter((c) => c.kind === "code");

  const nav: { label: string; icon: IconName; action: NavAction }[] = [
    { label: p.mode === "chat" ? "Nova conversa" : "Nova sessão", icon: "plus", action: "new" },
    { label: "Procurar", icon: "search", action: "search" },
    ...(p.mode === "chat" ? [{ label: "Projetos", icon: "folder" as IconName, action: "projects" as NavAction }] : []),
    { label: "Artefatos", icon: "artifacts", action: "artifacts" },
    { label: "Agendados", icon: "clock", action: "automations" },
    { label: "Plugins", icon: "puzzle", action: "plugins" },
  ];
  const activeNav: Partial<Record<NavAction, boolean>> = {
    projects: p.view === "projects",
    artifacts: p.view === "artifacts",
    automations: p.view === "automations",
  };

  const groups: [string, Conversation[]][] =
    p.mode === "chat"
      ? ([["Fixados", chatList.filter((c) => c.pinned)], ["Recentes", chatList.filter((c) => !c.pinned)]] as [string, Conversation[]][]).filter(([, v]) => v.length > 0)
      : byFolder(codeList);
  const scopedCount = p.mode === "chat" ? chatList.length : codeList.length;

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <button className="icon-btn" onClick={p.onCollapse} title="Ocultar barra lateral (Ctrl+B)" aria-label="Ocultar barra lateral"><Icon name="sidebar" size={16} /></button>
        <button className="icon-btn" onClick={p.onBack} disabled={!p.canBack} title="Voltar" aria-label="Voltar"><Icon name="left" size={16} /></button>
        <button className="icon-btn" onClick={p.onForward} disabled={!p.canForward} title="Avançar" aria-label="Avançar"><Icon name="right" size={16} /></button>
        <span className="spacer" />
        <div className="mode-icons" role="group" aria-label="Modo">
          <button aria-pressed={p.mode === "chat"} onClick={() => p.onMode("chat")} title="Chat" aria-label="Chat"><Icon name="chat" size={15} /></button>
          <button aria-pressed={p.mode === "code"} onClick={() => p.onMode("code")} title="Code" aria-label="Code"><Icon name="code" size={15} /></button>
        </div>
      </div>

      <nav className="nav">
        {nav.map((n) => (
          <button key={n.action} onClick={() => p.onNav(n.action)} disabled={n.action === "new" && p.disabled} className={activeNav[n.action] ? "active" : ""} aria-label={n.label} aria-current={activeNav[n.action] ? "page" : undefined}>
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-list">
        {groups.map(([label, items]) => {
          const isClosed = closed[label];
          return (
            <div key={label} className="sb-group">
              <button className="sb-section" onClick={() => setClosed({ ...closed, [label]: !isClosed })} aria-expanded={!isClosed}>
                <span className="sb-section-label">{label}</span>
                <Icon name={isClosed ? "right" : "chevron"} size={12} />
              </button>
              {!isClosed && items.map((c) => <ConvRow key={c.id} c={c} active={c.id === p.activeId && p.view === "chat"} p={p} />)}
            </div>
          );
        })}

        {scopedCount === 0 && (
          <p className="sb-empty">
            {p.mode === "chat" ? "Nenhuma conversa ainda." : "Nenhuma sessão ainda. Clique em Nova sessão e escolha uma pasta."}
          </p>
        )}
      </div>

      <div className="sb-foot" ref={footRef}>
        {profileOpen && (
          <div className="menu up">
            <div className="menu-label">Perfil local · nenhum dado sai deste computador</div>
            <button onClick={() => { setProfileOpen(false); p.onSettings(); }}><Icon name="settings" size={15} /> Configurações <kbd>Ctrl+,</kbd></button>
            <button onClick={() => { setProfileOpen(false); p.onTheme(p.theme === "escuro" ? "claro" : "escuro"); }}>
              <Icon name={p.theme === "escuro" ? "sun" : "moon"} size={15} /> {p.theme === "escuro" ? "Tema claro" : "Tema escuro"}
            </button>
            <button onClick={() => { setProfileOpen(false); p.onShortcuts(); }}><Icon name="keyboard" size={15} /> Atalhos de teclado</button>
          </div>
        )}
        <button className="profile-btn" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen} title="Perfil e configurações">
          <span className="avatar">Z</span>
          <span className="profile-text">Você <small>· Local</small></span>
          <Icon name="chevron" size={13} />
        </button>
        <button className="icon-btn" onClick={p.onSettings} title="Configurações (Ctrl+,)" aria-label="Configurações"><Icon name="settings" size={16} /></button>
      </div>
    </aside>
  );
}

function ConvRow({ c, active, p }: { c: Conversation; active: boolean; p: Props }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  return (
    <div className={`conv ${active ? "active" : ""} ${menu ? "menu-open" : ""}`} ref={ref}>
      <button className="conv-title" onClick={() => p.onSelect(c.id)} onDoubleClick={() => p.onRename(c)} title={c.title}>
        {c.title}
      </button>
      <button className="conv-more" onClick={() => setMenu((v) => !v)} title="Mais opções" aria-label={`Opções de ${c.title}`}><Icon name="more" size={16} /></button>
      {menu && (
        <div className="menu conv-menu">
          <button onClick={() => { setMenu(false); p.onPin(c); }}><Icon name="pin" size={15} /> {c.pinned ? "Desafixar" : "Fixar"}</button>
          <button onClick={() => { setMenu(false); p.onRename(c); }}><Icon name="pencil" size={15} /> Renomear</button>
          <div className="sep" />
          <button className="danger" onClick={() => { setMenu(false); p.onDelete(c.id); }}><Icon name="trash" size={15} /> Excluir</button>
        </div>
      )}
    </div>
  );
}
