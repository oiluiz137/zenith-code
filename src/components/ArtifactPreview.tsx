import { Icon } from "./Icons";

/** Pré-visualização isolada de HTML (artefato). Scripts rodam, mas sem acesso à origem do app. */
export function ArtifactPreview({ html, onClose }: { html: string; onClose: () => void }) {
  const title = /<title>(.*?)<\/title>/i.exec(html)?.[1] ?? "Pré-visualização";
  function openTab() {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "pagina"}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal artifact" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header>
          <strong className="ellipsis">{title}</strong>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(html)}><Icon name="copy" size={14} /> Copiar código</button>
          <button className="btn sm ghost" onClick={download}><Icon name="down" size={14} /> Baixar</button>
          <button className="btn sm ghost" onClick={openTab}><Icon name="external" size={14} /> Nova aba</button>
          <button className="icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar"><Icon name="x" size={16} /></button>
        </header>
        <iframe title={title} sandbox="allow-scripts allow-forms allow-modals" srcDoc={html} />
      </div>
    </div>
  );
}

/** Extrai blocos ```html de uma resposta. */
export function htmlBlocks(text: string): string[] {
  const out: string[] = [];
  const re = /```html\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}
