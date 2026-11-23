// O pacote katex não traz tipos próprios neste projeto; declaramos só o que usamos.
declare module "katex" {
  export function renderToString(tex: string, options?: { displayMode?: boolean; throwOnError?: boolean }): string;
  const katex: { renderToString: typeof renderToString };
  export default katex;
}
