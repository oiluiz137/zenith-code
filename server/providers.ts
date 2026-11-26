// Provedores de modelo do Zenith Code 1.0.
// - native: modelo GGUF carregado dentro do próprio app (sem servidor).
// - openai: API compatível com OpenAI (OpenAI, OpenRouter e outros endpoints de nuvem).
// - anthropic: API de mensagens da Anthropic.
import type { ChatMessage, ProviderConfig, ToolCall, ToolSpec } from "./types.ts";
import { generate, listLocalModels } from "./native.ts";

export interface StreamOptions {
  provider: ProviderConfig;
  model: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Só o modelo nativo: deixa o Qwen3 pensar antes de responder. */
  thinking?: boolean;
  onThinking?: (text: string) => void;
}

export interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
  thinking?: string;
}

export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  switch (opts.provider.kind) {
    case "native":
      return generate({ modelFile: opts.model, messages: opts.messages, tools: opts.tools, signal: opts.signal, onDelta: opts.onDelta, temperature: opts.temperature, topP: opts.topP, maxTokens: opts.maxTokens, thinking: opts.thinking, onThinking: opts.onThinking });
    case "openai":
      return streamOpenAI(opts);
    case "anthropic":
      return streamAnthropic(opts);
  }
}

export async function listModels(provider: ProviderConfig): Promise<string[]> {
  if (provider.kind === "native") return listLocalModels();
  try {
    return await fetchModels(provider);
  } catch (err) {
    const cause = (err as Error).message;
    if (/fetch failed|ECONNREFUSED/i.test(cause)) {
      throw new Error(`${provider.name} não respondeu em ${provider.baseUrl}. Verifique a URL e a conexão.`);
    }
    throw err;
  }
}

async function fetchModels(provider: ProviderConfig): Promise<string[]> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  if (provider.kind === "openai") {
    const res = await fetch(`${base}/models`, { headers: authHeaders(provider) });
    if (!res.ok) throw new Error(`${provider.name} respondeu ${res.status}`);
    const json: any = await res.json();
    return (json.data ?? []).map((m: any) => m.id as string);
  }
  const res = await fetch(`${base}/v1/models`, {
    headers: { "x-api-key": provider.apiKey ?? "", "anthropic-version": "2023-06-01" },
  });
  if (!res.ok) throw new Error(`Anthropic respondeu ${res.status}`);
  const json: any = await res.json();
  return (json.data ?? []).map((m: any) => m.id as string);
}

function authHeaders(p: ProviderConfig): Record<string, string> {
  return p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {};
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(`${label} erro ${res.status}: ${text.slice(0, 500)}`);
}

/** Lê o corpo da resposta linha a linha. */
async function* readLines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      yield line;
    }
  }
  if (buffer.trim()) yield buffer;
}

// ---------- OpenAI-compatível ----------

function toOpenAI(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) } })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

async function streamOpenAI(o: StreamOptions): Promise<StreamResult> {
  const base = o.provider.baseUrl.replace(/\/+$/, "");
  const body: Record<string, unknown> = { model: o.model, messages: toOpenAI(o.messages), stream: true, temperature: o.temperature, top_p: o.topP };
  if (o.tools.length) {
    body.tools = o.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(o.provider) },
    body: JSON.stringify(body),
    signal: o.signal,
  });
  await assertOk(res, o.provider.name);
  let content = "";
  const pending = new Map<number, { id: string; name: string; args: string }>();
  for await (const raw of readLines(res)) {
    const line = raw.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") break;
    const json: any = safeJson(payload);
    const delta = json.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      content += delta.content;
      o.onDelta(delta.content);
    }
    for (const tc of delta.tool_calls ?? []) {
      const entry = pending.get(tc.index) ?? { id: "", name: "", args: "" };
      if (tc.id) entry.id = tc.id;
      if (tc.function?.name) entry.name += tc.function.name;
      if (tc.function?.arguments) entry.args += tc.function.arguments;
      pending.set(tc.index, entry);
    }
  }
  const toolCalls: ToolCall[] = [...pending.values()].map((e, i) => ({
    id: e.id || `call_${i}_${Date.now()}`,
    name: e.name,
    args: safeJson(e.args || "{}"),
  }));
  return { content, toolCalls };
}

// ---------- Anthropic ----------

function toAnthropic(messages: ChatMessage[]) {
  const out: { role: "user" | "assistant"; content: any[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      if (last && last.role === "user" && last.content.every((b) => b.type === "tool_result")) last.content.push(block);
      else out.push({ role: "user", content: [block] });
      continue;
    }
    if (m.role === "assistant") {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
      if (blocks.length === 0) blocks.push({ type: "text", text: " " });
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: "user", content: [{ type: "text", text: m.content || " " }] });
  }
  return out;
}

async function streamAnthropic(o: StreamOptions): Promise<StreamResult> {
  const base = o.provider.baseUrl.replace(/\/+$/, "");
  const system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  // Cache de prompt: o bloco de sistema (instruções, skills, memória) é reaproveitado entre turnos.
  const body: Record<string, unknown> = {
    model: o.model,
    max_tokens: o.maxTokens ?? 4096,
    // A Anthropic aceita temperatura de 0 a 1. O top-p não é enviado junto: alguns modelos recusam os dois.
    temperature: o.temperature !== undefined ? Math.min(o.temperature, 1) : undefined,
    system: system ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : undefined,
    messages: toAnthropic(o.messages),
    stream: true,
  };
  if (o.tools.length) {
    body.tools = o.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": o.provider.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: o.signal,
  });
  await assertOk(res, "Anthropic");
  let content = "";
  const toolCalls: ToolCall[] = [];
  const blocks = new Map<number, { type: string; id?: string; name?: string; json: string }>();
  for await (const raw of readLines(res)) {
    const line = raw.trim();
    if (!line.startsWith("data:")) continue;
    const json: any = safeJson(line.slice(5).trim());
    switch (json.type) {
      case "content_block_start": {
        const cb = json.content_block;
        blocks.set(json.index, { type: cb.type, id: cb.id, name: cb.name, json: "" });
        break;
      }
      case "content_block_delta": {
        const b = blocks.get(json.index);
        if (json.delta?.type === "text_delta") {
          content += json.delta.text;
          o.onDelta(json.delta.text);
        } else if (json.delta?.type === "input_json_delta" && b) {
          b.json += json.delta.partial_json ?? "";
        }
        break;
      }
      case "content_block_stop": {
        const b = blocks.get(json.index);
        if (b && b.type === "tool_use") toolCalls.push({ id: b.id ?? `toolu_${Date.now()}`, name: b.name ?? "", args: safeJson(b.json || "{}") });
        break;
      }
      case "error":
        throw new Error(`Anthropic: ${json.error?.message ?? "erro desconhecido"}`);
    }
  }
  return { content, toolCalls };
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
