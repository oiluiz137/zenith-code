import { useState } from "react";
import { api } from "../api";

interface Line {
  kind: "cmd" | "out" | "err";
  text: string;
}

/** Terminal do usuário na pasta de trabalho. Comandos digitados aqui são ações do próprio usuário. */
export function Terminal({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<Line[]>([{ kind: "out", text: "Terminal da pasta de trabalho. Digite um comando e pressione Enter." }]);
  const [busy, setBusy] = useState(false);

  async function run() {
    const command = input.trim();
    if (!command || busy) return;
    setInput("");
    setBusy(true);
    setLines((l) => [...l, { kind: "cmd", text: `PS> ${command}` }]);
    try {
      const r = await api.terminal(command);
      setLines((l) => [...l, { kind: r.ok ? "out" : "err", text: r.output || "(sem saída)" }]);
    } catch (err) {
      setLines((l) => [...l, { kind: "err", text: (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={inline ? "terminal inline" : "terminal"}>
      {!inline && (
        <header>
          <strong>Terminal</strong>
          <button className="btn sm ghost" onClick={onClose} title="Fechar terminal">Fechar</button>
        </header>
      )}
      <pre className="term-output">
        {lines.map((l, i) => (
          <div key={i} className={`term-${l.kind}`}>{l.text}</div>
        ))}
      </pre>
      <div className="term-quick">
        {["git status --short", "git diff --stat", "git log --oneline -5", "npm test"].map((c) => (
          <button key={c} disabled={busy} onClick={() => setInput(c)}>{c}</button>
        ))}
      </div>
      <div className="term-input">
        <input
          value={input}
          placeholder={busy ? "executando…" : "comando"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          disabled={busy}
        />
        <button className="btn sm" onClick={run} disabled={busy || !input.trim()}>Executar</button>
      </div>
    </section>
  );
}
