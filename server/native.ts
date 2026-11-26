// Runtime nativo: carrega modelos GGUF diretamente no processo do Zenith (llama.cpp via node-llama-cpp).
// Não há servidor, porta nem processo externo. Os modelos ficam na pasta models/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLlama, LlamaCompletion, type Llama, type LlamaModel, type LlamaContext } from "node-llama-cpp";
import type { ChatMessage, ToolCall, ToolSpec } from "./types.ts";

import { MODELS_DIR } from "./paths.ts";
export { MODELS_DIR };

export const CONTEXT_SIZE = 8192;

/** Conta tokens com o tokenizador do modelo carregado. Retorna null se nenhum modelo estiver carregado. */
export function countTokens(text: string): number | null {
  if (!loaded || !text) return loaded ? 0 : null;
  try {
    return loaded.model.tokenize(text).length;
  } catch {
    return null;
  }
}
const STOP = ["<|im_end|>", "<|endoftext|>"];

interface Loaded {
  path: string;
  model: LlamaModel;
  context: LlamaContext;
  completion: LlamaCompletion;
}

let llamaPromise: Promise<Llama> | null = null;
let loaded: Loaded | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getRuntime(): Promise<Llama> {
  llamaPromise ??= getLlama();
  return llamaPromise;
}

/** Lista os arquivos .gguf disponíveis em models/. */
export function listLocalModels(): string[] {
  if (!fs.existsSync(MODELS_DIR)) return [];
  return fs.readdirSync(MODELS_DIR).filter((f) => f.toLowerCase().endsWith(".gguf")).sort();
}

export interface RuntimeInfo {
  gpu: string | false;
  model: string | null;
  loaded: boolean;
}

export async function runtimeInfo(): Promise<RuntimeInfo> {
  const llama = await getRuntime();
  return { gpu: llama.gpu, model: loaded ? path.basename(loaded.path) : null, loaded: !!loaded };
}

async function ensureLoaded(modelFile: string): Promise<Loaded> {
  const full = path.join(MODELS_DIR, path.basename(modelFile));
  if (!fs.existsSync(full)) throw new Error(`Modelo não encontrado em models/: ${modelFile}`);
  if (loaded && loaded.path === full) return loaded;
  if (loaded) {
    await loaded.context.dispose();
    await loaded.model.dispose();
    loaded = null;
  }
  const llama = await getRuntime();
  const model = await llama.loadModel({ modelPath: full });
  const context = await model.createContext({ contextSize: CONTEXT_SIZE });
  // Uma sequência de contexto por modelo, criada uma vez e reutilizada em todos os turnos.
  const completion = new LlamaCompletion({ contextSequence: context.getSequence() });
  loaded = { path: full, model, context, completion };
  return loaded;
}

/** Monta o prompt no formato de chat do Qwen (ChatML) com definições de ferramenta. */
export function buildPrompt(messages: ChatMessage[], tools: ToolSpec[], thinking = false): string {
  const toolLines = tools.map((t) => JSON.stringify({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  let out = "";
  const toolBlock = tools.length
    ? `\n\n# Ferramentas\nVocê pode chamar as funções abaixo quando precisar delas.\n<tools>\n${toolLines.join("\n")}\n</tools>\nPara chamar uma função, responda somente com um objeto JSON dentro de <tool_call></tool_call>, no formato {"name": "<nome>", "arguments": {...}}.`
    : "";
  out += `<|im_start|>system\n${system}${toolBlock}<|im_end|>\n`;
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") out += `<|im_start|>user\n${m.content}<|im_end|>\n`;
    else if (m.role === "tool") out += `<|im_start|>user\n<tool_response>\n${m.content}\n</tool_response><|im_end|>\n`;
    else {
      // O raciocínio guardado numa resposta anterior não volta ao modelo.
      let body = stripThinking(m.content ?? "");
      for (const tc of m.toolCalls ?? []) body += `\n<tool_call>\n${JSON.stringify({ name: tc.name, arguments: tc.args })}\n</tool_call>`;
      out += `<|im_start|>assistant\n${body.trim()}<|im_end|>\n`;
    }
  }
  // Sem raciocínio: bloco <think> vazio (o Qwen3 responde direto). Com raciocínio: deixa o bloco aberto.
  out += thinking ? "<|im_start|>assistant\n<think>\n" : "<|im_start|>assistant\n<think>\n\n</think>\n\n";
  return out;
}

/** Remove blocos <think>...</think> (e um bloco aberto no fim) de um texto. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/<think>[\s\S]*$/, "").trim();
}

/** Extrai o texto do primeiro bloco <think> (fechado ou ainda aberto). */
export function extractThinking(text: string): string {
  const m = /<think>([\s\S]*?)(<\/think>|$)/.exec(text);
  return m ? m[1].trim() : "";
}

/** Extrai objetos JSON equilibrados de um texto (respeitando strings). */
function extractJsonObjects(text: string): { json: string; start: number; end: number }[] {
  const out: { json: string; start: number; end: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === "\\") j++;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          out.push({ json: text.slice(i, j + 1), start: i, end: j + 1 });
          i = j;
          break;
        }
      }
    }
  }
  return out;
}

/** Converte o texto gerado em texto visível e chamadas de ferramenta.
 * Aceita <tool_call>{...}</tool_call> e, como reserva, objetos {"name", "arguments"} soltos ou em blocos de código. */
export function parseOutput(raw: string): { content: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/, "").replace(/<\|im_end\|>|<\|endoftext\|>/g, "");
  const spans: { start: number; end: number }[] = [];
  const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    spans.push({ start: m.index, end: m.index + m[0].length });
    try {
      const obj = JSON.parse(m[1]);
      toolCalls.push({ id: `call_${toolCalls.length + 1}_${Date.now()}`, name: String(obj.name ?? ""), args: obj.arguments ?? {} });
    } catch {
      // Chamada malformada: ignorada.
    }
  }
  if (toolCalls.length === 0) {
    for (const found of extractJsonObjects(cleaned)) {
      try {
        const obj = JSON.parse(found.json);
        if (typeof obj.name === "string" && obj.arguments !== undefined) {
          toolCalls.push({ id: `call_${toolCalls.length + 1}_${Date.now()}`, name: obj.name, args: obj.arguments ?? {} });
          spans.push({ start: found.start, end: found.end });
        }
      } catch {
        // não é chamada de ferramenta
      }
    }
  }
  let content = cleaned;
  for (const s of [...spans].sort((a, b) => b.start - a.start)) content = content.slice(0, s.start) + content.slice(s.end);
  content = content.replace(/```(json)?\s*```/g, "").trim();
  return { content, toolCalls };
}

export interface GenerateOptions {
  modelFile: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  thinking?: boolean;
  onThinking?: (text: string) => void;
}

/** Gera uma resposta. Uma geração por vez (fila), pois o contexto é único. */
export function generate(opts: GenerateOptions): Promise<{ content: string; toolCalls: ToolCall[]; thinking?: string }> {
  const run = queue.then(() => doGenerate(opts), () => doGenerate(opts));
  queue = run.catch(() => undefined);
  return run;
}

async function doGenerate(opts: GenerateOptions): Promise<{ content: string; toolCalls: ToolCall[]; thinking?: string }> {
  const { completion } = await ensureLoaded(opts.modelFile);
  const prompt = buildPrompt(opts.messages, opts.tools, !!opts.thinking);
  // O prompt já termina com "<think>\n"; o texto gerado começa dentro do bloco de raciocínio.
  let raw = opts.thinking ? "<think>\n" : "";
  let shownThinking = "";
  let shown = "";
  let stopped = false;

  // Só envia ao usuário o texto visível: sem bloco <think> e sem <tool_call>.
  const visible = (): string => {
    let text = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
    // Raciocínio ainda em andamento (bloco aberto): não é texto da resposta.
    const openThink = text.indexOf("<think>");
    if (openThink >= 0) text = text.slice(0, openThink);
    // Respostas que começam com JSON ou bloco de código podem ser chamadas de ferramenta: só mostram no fim.
    const head = text.trimStart();
    if (head.startsWith("{") || head.startsWith("```")) return "";
    const cut = text.indexOf("<tool_call>");
    if (cut >= 0) {
      text = text.slice(0, cut);
    } else {
      // Segura um possível início de "<tool_call>" ou "<think>" no fim do texto.
      const hold = [...["<tool_call>", "<think>"]].map((tag) => {
        for (let k = tag.length - 1; k > 0; k--) if (text.endsWith(tag.slice(0, k))) return k;
        return 0;
      });
      text = text.slice(0, text.length - Math.max(...hold));
    }
    return text;
  };

  try {
    await completion.generateCompletion(prompt, {
      maxTokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
      topP: opts.topP ?? 0.8,
      repeatPenalty: { penalty: 1.05 },
      customStopTriggers: STOP,
      signal: opts.signal,
      onTextChunk: (chunk: string) => {
        raw += chunk;
        if (opts.thinking && opts.onThinking) {
          const th = extractThinking(raw);
          if (th.length > shownThinking.length) {
            opts.onThinking(th.slice(shownThinking.length));
            shownThinking = th;
          }
        }
        const text = visible();
        if (text.length > shown.length && !stopped) {
          opts.onDelta(text.slice(shown.length));
          shown = text;
        }
        if (raw.includes("</tool_call>")) stopped = true;
      },
    });
  } catch (err) {
    if (!opts.signal.aborted) throw err;
  }
  const parsed = parseOutput(raw);
  const thinking = opts.thinking ? extractThinking(raw) : "";
  return thinking ? { ...parsed, thinking } : parsed;
}
