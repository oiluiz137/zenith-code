import { useState } from "react";
import { api, type AgentEdit } from "../api";
import { Icon } from "./Icons";

const STATUS_LABEL: Record<AgentEdit["status"], string> = {
  applied: "aguardando revisão",
  partial: "revertida em parte",
  reverted: "revertida",
  accepted: "mantida",
};

/**
 * Revisão das edições do agente: ver a diferença, manter, reverter o arquivo inteiro
 * ou reverter só um trecho.
 */
export function EditsReview({ edits, onChanged, onNotice, compact = false }: { edits: AgentEdit[]; onChanged: () => void; onNotice: (m: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  if (edits.length === 0) return null;
  const pending = edits.filter((e) => e.reviewable && (e.status === "applied" || e.status === "partial"));
  const added = edits.reduce((n, e) => n + e.added, 0);
  const removed = edits.reduce((n, e) => n + e.removed, 0);

  async function act(key: string, run: () => Promise<{ message: string }>) {
    setBusy(key);
    try {
      const r = await run();
      onNotice(r.message);
    } catch (e) {
      onNotice((e as Error).message);
    } finally {
      setBusy("");
      onChanged();
    }
  }

  return (
    <div className={`edits ${compact ? "compact" : ""}`}>
      <div className="edits-head">
        <Icon name="doc" size={15} />
        <span className="grow">
          {edits.length} arquivo{edits.length > 1 ? "s" : ""} alterado{edits.length > 1 ? "s" : ""} <span className="add">+{added}</span> <span className="del">−{removed}</span>
        </span>
        {pending.length > 1 && (
          <>
            <button className="btn sm ghost" disabled={!!busy} onClick={() => act("all-keep", async () => { for (const e of pending) await api.acceptEdit(e.id); return { message: "Alterações mantidas." }; })}>Manter todas</button>
            <button className="btn sm ghost" disabled={!!busy} onClick={() => act("all-revert", async () => { for (const e of [...pending].reverse()) await api.revertEdit(e.id); return { message: "Alterações revertidas." }; })}>Reverter todas</button>
          </>
        )}
      </div>
      {edits.map((e) => {
        const isOpen = open[e.id] ?? false;
        const canAct = e.reviewable && (e.status === "applied" || e.status === "partial") && !e.stale;
        return (
          <div key={e.id} className={`edit-file st-${e.status}`}>
            <div className="edit-row">
              <button className="edit-name" onClick={() => setOpen({ ...open, [e.id]: !isOpen })} aria-expanded={isOpen} title={e.relPath}>
                <Icon name={isOpen ? "chevron" : "right"} size={12} />
                <span className="ellipsis">{e.relPath}</span>
                {!e.existed && <span className="tag">novo</span>}
              </button>
              <span className="add">+{e.added}</span>
              <span className="del">−{e.removed}</span>
              <span className={`edit-status ${e.status}`}>{e.stale && (e.status === "applied" || e.status === "partial") ? "mudou depois" : STATUS_LABEL[e.status]}</span>
              {canAct && (
                <>
                  <button className="btn sm ghost" disabled={!!busy} onClick={() => act(e.id + "k", () => api.acceptEdit(e.id))} title="Manter a alteração"><Icon name="check" size={13} /> Manter</button>
                  <button className="btn sm ghost" disabled={!!busy} onClick={() => act(e.id + "r", () => api.revertEdit(e.id))} title="Voltar o arquivo ao que era antes"><Icon name="refresh" size={13} /> Reverter</button>
                </>
              )}
            </div>
            {isOpen && (
              <div className="edit-hunks">
                {!e.reviewable && <p className="hint">Edição feita antes da revisão por trecho existir. Use Desfazer no menu da conversa.</p>}
                {e.reviewable && e.hunks.length === 0 && <p className="hint">Sem diferenças restantes.</p>}
                {e.hunks.map((h) => (
                  <div key={h.index} className="hunk">
                    <div className="hunk-head">
                      <span className="grow">Linhas {h.newStart}–{h.newStart + h.lines.filter((l) => !l.startsWith("-")).length - 1}</span>
                      {canAct && e.hunks.length > 1 && (
                        <button className="link" disabled={!!busy} onClick={() => act(e.id + h.index, () => api.revertEdit(e.id, [h.index]))}>Reverter este trecho</button>
                      )}
                    </div>
                    <pre className="diff">
                      {h.lines.map((l, i) => (
                        <span key={i} className={l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : ""}>{l}{"\n"}</span>
                      ))}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
