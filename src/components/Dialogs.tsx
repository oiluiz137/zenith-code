import { useEffect, useRef, useState } from "react";

// Diálogos próprios (substituem window.prompt e window.confirm, que não existem no app de desktop).
type Request =
  | { kind: "text"; title: string; label?: string; initial?: string; placeholder?: string; confirm?: string; resolve: (v: string | null) => void }
  | { kind: "confirm"; title: string; message: string; confirm?: string; danger?: boolean; resolve: (v: boolean) => void };

let push: ((r: Request) => void) | null = null;

export function askText(opts: { title: string; label?: string; initial?: string; placeholder?: string; confirm?: string }): Promise<string | null> {
  return new Promise((resolve) => (push ? push({ kind: "text", ...opts, resolve }) : resolve(null)));
}

export function askConfirm(opts: { title: string; message: string; confirm?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => (push ? push({ kind: "confirm", ...opts, resolve }) : resolve(false)));
}

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    push = (r) => {
      setValue(r.kind === "text" ? r.initial ?? "" : "");
      setReq(r);
    };
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (req?.kind === "text") setTimeout(() => inputRef.current?.select(), 0);
  }, [req]);

  if (!req) return null;

  const close = (ok: boolean) => {
    if (req.kind === "text") req.resolve(ok ? value.trim() || null : null);
    else req.resolve(ok);
    setReq(null);
  };

  return (
    <div className="overlay" onMouseDown={() => close(false)}>
      <div className="modal dialog" role="dialog" aria-modal="true" aria-label={req.title} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close(false);
          if (e.key === "Enter" && (req.kind === "confirm" || value.trim())) close(true);
        }}>
        <div className="modal-body">
          <h3 className="dialog-title">{req.title}</h3>
          {req.kind === "confirm" && <p className="dialog-text">{req.message}</p>}
          {req.kind === "text" && (
            <label className="field">
              {req.label && <span>{req.label}</span>}
              <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={req.placeholder} autoFocus spellCheck={false} />
            </label>
          )}
        </div>
        <footer>
          <span className="spacer" />
          <button className="btn ghost" onClick={() => close(false)}>Cancelar</button>
          <button className={`btn ${req.kind === "confirm" && req.danger ? "danger-solid" : "primary"}`} onClick={() => close(true)} disabled={req.kind === "text" && !value.trim()} autoFocus={req.kind === "confirm"}>
            {req.confirm ?? (req.kind === "confirm" ? "Confirmar" : "OK")}
          </button>
        </footer>
      </div>
    </div>
  );
}
