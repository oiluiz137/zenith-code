import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import "katex/dist/katex.min.css";

/** Troca $...$ e $$...$$ por fórmulas renderizadas, sem mexer em blocos de código. */
function renderMath(html: string): string {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => katex.renderToString(tex, { displayMode: true, throwOnError: false }))
        .replace(/\$([^\n$]+?)\$/g, (_m, tex: string) => katex.renderToString(tex, { throwOnError: false }));
    })
    .join("");
}

/** Renderiza Markdown vindo do modelo, com fórmulas LaTeX, sanitizado para evitar scripts. */
export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(renderMath(raw));
  }, [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
