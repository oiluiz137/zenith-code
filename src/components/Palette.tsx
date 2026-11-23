import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Conversation } from "../../server/types";
import { Icon, type IconName } from "./Icons";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

interface Props {
  actions: PaletteAction[];
  conversations: Conversation[];
  onOpenChat: (id: string) => void;
  onClose: () => void;
}

/** Paleta de comandos (Ctrl+K): ações e conversas, com busca por texto. */
export function Palette({ actions, conversations, onOpenChat, onClose }: Props) {
  // Ações planejadas (sem backend ainda) aparecem com aviso, para a interface já mostrar o caminho.
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const acts = actions.filter((a) => !term || a.label.toLowerCase().includes(term));
    const convs = conversations
      .filter((c) => term && c.title.toLowerCase().includes(term))
      .slice(0, 8)
      .map((c) => ({ id: `c-${c.id}`, label: c.title, hint: "conversa", icon: "doc" as IconName, run: () => onOpenChat(c.id) }));
    return [...acts, ...convs];
  }, [q, actions, conversations, onOpenChat]);

  useEffect(() => setSel(0), [q]);

  function onKey(e: ReactKeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && items[sel]) { items[sel].run(); onClose(); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal palette" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar ações e conversas…" />
        <div className="items">
          {items.length === 0 && <p className="hint" style={{ padding: 12 }}>Nada encontrado.</p>}
          {items.map((it, i) => (
            <button key={it.id} className={i === sel ? "sel" : ""} onMouseEnter={() => setSel(i)} onClick={() => { it.run(); onClose(); }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name={it.icon} size={16} /> {it.label}</span>
              {it.hint && <small>{it.hint}</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
