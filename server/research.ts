// Pesquisa profunda (/pesquisa): planeja buscas, lê as páginas e escreve um relatório com citações numeradas [1], [2]…
// A lista de fontes é montada pelo programa (links reais), nunca escrita pelo modelo.
import { executeTool } from "./tools.ts";
import type { Settings, StreamEvent, ToolCall } from "./types.ts";

export interface Source {
  n: number;
  title: string;
  url: string;
  snippet: string;
  excerpt: string;
}

export interface ResearchStep {
  call: ToolCall;
  output: string;
}

export interface ResearchResult {
  report: string;
  sources: Source[];
  steps: ResearchStep[];
}

/** Lê o texto devolvido por web_search ("1. título\nurl\nresumo") em resultados estruturados. */
export function parseSearchOutput(output: string): { title: string; url: string; snippet: string }[] {
  const hits: { title: string; url: string; snippet: string }[] = [];
  const re = /^\d+\.\s+(.+)\n(https?:\/\/\S+)\n?(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) hits.push({ title: m[1].trim(), url: m[2].trim(), snippet: m[3].trim() });
  return hits;
}

/** Extrai a lista de buscas do plano do modelo (JSON, lista numerada ou linhas soltas). */
export function parseQueries(text: string, topic: string, max = 3): string[] {
  const json = /\[[\s\S]*?\]/.exec(text);
  if (json) {
    try {
      const arr = JSON.parse(json[0]);
      const qs = (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean);
      if (qs.length) return [...new Set(qs)].slice(0, max);
    } catch {
      /* cai para linhas */
    }
  }
  const lines = text.split("\n").map((l) => l.replace(/^[\s\-*\d.)"]+|["\s]+$/g, "").trim()).filter((l) => l.length > 3 && l.length < 140);
  return [...new Set(lines.length ? lines : [topic])].slice(0, max);
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/** Troca [n] com n fora da lista de fontes (inventado pelo modelo) por nada. */
export function dropUnknownCitations(text: string, total: number): string {
  return text
    .replace(/\[(\d{1,3})\]/g, (all, n) => (Number(n) >= 1 && Number(n) <= total ? all : ""))
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

const STOP = new Set(["como", "qual", "quais", "para", "sobre", "porque", "mais", "menos", "that", "what", "with", "from", "this", "have", "does", "como", "uma", "uns", "das", "dos", "the", "and", "for"]);

/** Palavras do tema (4+ letras, sem as comuns) para medir se um resultado fala do assunto. */
export function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9.+#]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

/** Quantas palavras do tema aparecem no título e no resumo do resultado. */
export function relevance(words: string[], title: string, snippet: string): number {
  const hay = `${title} ${snippet}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return words.filter((w) => hay.includes(w)).length;
}

export interface ResearchOptions {
  topic: string;
  settings: Settings;
  /** Modelo local tem contexto pequeno: menos fontes e trechos menores. */
  compact: boolean;
  signal: AbortSignal;
  emit: (e: StreamEvent) => void;
  /** Pergunta ao modelo; com onDelta, transmite a resposta. */
  ask: (system: string, user: string, onDelta?: (t: string) => void) => Promise<string>;
}

export async function deepResearch(o: ResearchOptions): Promise<ResearchResult> {
  const maxSources = o.compact ? 5 : 8;
  const excerptChars = o.compact ? 1100 : 3500;
  const steps: ResearchStep[] = [];
  let seq = 0;

  const runTool = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const call: ToolCall = { id: `pesq_${++seq}_${Date.now()}`, name, args };
    o.emit({ type: "tool_start", id: call.id, name, args });
    let result: { ok: boolean; output: string };
    try {
      result = await executeTool(name, args, o.settings);
    } catch (e) {
      result = { ok: false, output: (e as Error).message };
    }
    o.emit({ type: "tool_result", id: call.id, name, ok: result.ok, output: result.output.slice(0, 1500) });
    // Guardado no histórico: curto, para não estourar o contexto das perguntas seguintes (modelo local: 8192 tokens).
    steps.push({ call, output: result.output.slice(0, o.compact ? 400 : 2000) });
    return result.ok ? result.output : "";
  };

  // 1. Plano de buscas
  o.emit({ type: "status", text: "Planejando as buscas" });
  const plan = await o.ask(
    "Você planeja pesquisas na web. Responda SOMENTE com um array JSON de 3 consultas de busca curtas e diferentes entre si (ângulos distintos do tema), no idioma mais útil para achar boas fontes. Exemplo: [\"consulta 1\", \"consulta 2\", \"consulta 3\"]",
    `Tema: ${o.topic}`,
  );
  const queries = parseQueries(plan, o.topic);

  // 2. Buscas e escolha das fontes
  const picked: Source[] = [];
  const seen = new Set<string>();
  const topicWords = keywords(o.topic);
  const perQuery = Math.max(2, Math.ceil(maxSources / queries.length));
  for (const q of queries) {
    if (o.signal.aborted) break;
    const out = await runTool("web_search", { query: q });
    let taken = 0;
    // Resultados sem nenhuma palavra do tema (ex.: outro significado da sigla) ficam de fora.
    const hits = parseSearchOutput(out).filter((h) => topicWords.length === 0 || relevance(topicWords, h.title, h.snippet) >= Math.min(2, topicWords.length)).sort((a, b) => relevance(topicWords, b.title, b.snippet) - relevance(topicWords, a.title, a.snippet));
    for (const h of hits) {
      const key = urlKey(h.url);
      if (seen.has(key) || picked.length >= maxSources || taken >= perQuery) continue;
      seen.add(key);
      taken++;
      picked.push({ n: picked.length + 1, title: h.title, url: h.url, snippet: h.snippet, excerpt: "" });
    }
  }
  if (picked.length === 0) {
    return { report: "Não encontrei fontes para este tema. As buscas podem estar bloqueadas no momento; tente de novo em instantes ou configure um SearXNG em Configurações > Pesquisa na web.", sources: [], steps };
  }

  // 3. Leitura das páginas
  for (const s of picked) {
    if (o.signal.aborted) break;
    const text = await runTool("web_fetch", { url: s.url });
    s.excerpt = (text || s.snippet).replace(/\s+/g, " ").trim().slice(0, excerptChars);
  }

  // 4. Relatório com citações, transmitido ao usuário
  o.emit({ type: "status", text: "Escrevendo o relatório" });
  const material = picked.map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\n${s.excerpt || s.snippet}`).join("\n\n");
  let streamed = "";
  const report = await o.ask(
    [
      "Você escreve relatórios de pesquisa. Use APENAS as fontes numeradas fornecidas.",
      "Regras: responda no idioma do tema; estruture em seções curtas com títulos em markdown; cite a fonte logo depois de cada afirmação no formato [n] (ex.: [2] ou [1][3]); só use números das fontes dadas;",
      "se as fontes forem insuficientes, fracas ou discordarem, diga isso claramente em vez de preencher lacunas; não invente dados, datas ou números; NÃO escreva a lista de fontes (o programa a adiciona).",
    ].join(" "),
    `Tema: ${o.topic}\n\nFontes:\n\n${material}`,
    (t) => {
      streamed += t;
      o.emit({ type: "delta", text: t });
    },
  );
  const clean = dropUnknownCitations(report || streamed, picked.length).trim();
  return { report: clean, sources: picked, steps };
}

export function sourcesMarkdown(sources: Source[]): string {
  if (sources.length === 0) return "";
  return "\n\n## Fontes\n\n" + sources.map((s) => `[${s.n}] [${s.title.replace(/[\[\]]/g, "")}](${s.url})`).join("  \n");
}
