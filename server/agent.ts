// Loop do agente: envia o histórico ao modelo, executa ferramentas com permissão e repete até a resposta final.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ChatMessage, Mode, ProviderConfig, Settings, StreamEvent, ToolSpec } from "./types.ts";
import { addCheckpoint, appendMessage, conversationFolder, conversationProjectId, getKv, getProject, getSettings, listMessages, listProjectFiles, saveSettings, setKv } from "./store.ts";
import { streamChat } from "./providers.ts";
import { APP_ROOT } from "./paths.ts";
import { deepResearch, sourcesMarkdown } from "./research.ts";
import { stripThinking } from "./native.ts";
import { TOOLS, executeTool, describeAction, permissionKey, resolveInside, type Risk } from "./tools.ts";
import { requestPermission, type Decision } from "./permissions.ts";
import { loadSkills, skillsIndex, type Skill } from "./skills.ts";
import { runHooks } from "./hooks.ts";
import { callMcpTool, ensureServers, mcpTools } from "./mcp.ts";
import { revealSecret } from "./secrets.ts";

const MAX_STEPS = 15;
const HISTORY_LIMIT = 80;

const LOAD_SKILL_TOOL: ToolSpec = {
  name: "load_skill",
  description: "Load the full instructions of an installed skill by name.",
  parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
};

const DELEGATE_TOOL: ToolSpec = {
  name: "delegate_task",
  description: "Delegate a read-only investigation to a subagent with its own fresh context (it can list/read files, search text and use the web, but cannot change anything). Use it to explore large parts of a project without filling your own context. Returns the subagent's summary.",
  parameters: { type: "object", properties: { task: { type: "string", description: "Complete, self-contained instructions for the subagent." } }, required: ["task"] },
};

const REMEMBER_TOOL: ToolSpec = {
  name: "remember",
  description: "Save one short, durable fact or preference about the user or project to persistent memory (shown in every future conversation). Use only when the user asks you to remember something or states a lasting preference. Never save secrets.",
  parameters: { type: "object", properties: { fact: { type: "string", description: "One short sentence." } }, required: ["fact"] },
};

/** Ferramentas que o subagente pode usar: só leitura e web. */
const SUBAGENT_TOOLS = new Set(["list_dir", "read_file", "search_text", "web_search", "web_fetch"]);
const SUBAGENT_STEPS = 8;

export interface ToolFlags {

  web: boolean;
  mcp: boolean;
  skills: boolean;
  exec: boolean;
}

export interface TurnParams {
  conversationId: string;
  text: string;
  providerId?: string;
  model?: string;
  mode?: Mode;
  toolFlags?: ToolFlags;
  signal: AbortSignal;
  emit: (event: StreamEvent) => void;
  /** Preenchido durante o turno: roda um subagente de leitura e devolve o resumo. */
  delegate?: (task: string) => Promise<string>;
}

const ALL_FLAGS: ToolFlags = { web: true, mcp: true, skills: true, exec: true };

/** Ferramentas desligadas nesta conversa não aparecem para o modelo e não podem ser chamadas. */
function flagFor(name: string): keyof ToolFlags | null {
  if (name === "web_search" || name === "web_fetch") return "web";
  if (name === "run_command") return "exec";
  if (name.startsWith("mcp__")) return "mcp";
  if (name === "load_skill") return "skills";
  return null;
}

export async function runTurn(p: TurnParams): Promise<void> {
  const settings = getSettings();
  // Pasta da conversa (ou do projeto) vira a pasta de trabalho deste turno.
  const folder = conversationFolder(p.conversationId);
  if (folder && fs.existsSync(folder)) settings.workspace = folder;
  const mode: Mode = p.mode ?? settings.mode;
  const disabledSkills = getKv<string[]>("disabledSkills", []);
  const skills = loadSkills(settings.workspace).filter((s) => !disabledSkills.includes(s.name));

  const storedProvider = settings.providers.find((x) => x.id === (p.providerId ?? settings.defaultProvider));
  const provider = storedProvider ? { ...storedProvider, apiKey: revealSecret(storedProvider.apiKey ?? "") } : undefined;
  const model = p.model || settings.defaultModel;
  try {
    if (!provider || !provider.enabled) throw new Error("Provedor não configurado ou desativado. Abra Configurações.");
    if (!model) throw new Error("Escolha um modelo antes de enviar a mensagem.");

    // Comando de skill: "/nome-da-skill texto" injeta as instruções da skill neste turno.
    const { text: userText, skillContext } = applySkillCommand(p.text, skills);
    if (userText.trim() === "/skills") {
      appendMessage(p.conversationId, { role: "user", content: p.text });
      const reply = skills.length ? skills.map((s) => `- **${s.name}** — ${s.description}`).join("\n") : "Nenhuma skill encontrada em `.zenith/skills/` da pasta de trabalho.";
      appendMessage(p.conversationId, { role: "assistant", content: reply });
      p.emit({ type: "delta", text: reply });
      p.emit({ type: "done" });
      return;
    }

    // Comandos de consulta: /memory mostra a memória do usuário; /permissions mostra o modo e as regras "sempre permitir".
    if (userText.trim() === "/memory" || userText.trim() === "/permissions") {
      appendMessage(p.conversationId, { role: "user", content: p.text });
      const reply = userText.trim() === "/memory"
        ? (memoryText(settings.workspace) ? `Memória do usuário:\n\n${memoryText(settings.workspace)}` : "A memória do usuário está vazia. Edite em Configurações > Memória.")
        : `Modo atual: **${mode}**.\n\nRegras "sempre permitir":\n${settings.alwaysAllow.length ? settings.alwaysAllow.map((a) => `- \`${a}\``).join("\n") : "- nenhuma"}`;
      appendMessage(p.conversationId, { role: "assistant", content: reply });
      p.emit({ type: "delta", text: reply });
      p.emit({ type: "done" });
      return;
    }

    // Comando /pesquisa <tema>: pesquisa profunda com várias buscas, leitura das páginas e relatório com citações.
    const research = /^\/pesquisa(?:-profunda)?\s+([\s\S]+)$/.exec(userText.trim());
    if (research || /^\/pesquisa(?:-profunda)?$/.test(userText.trim())) {
      appendMessage(p.conversationId, { role: "user", content: p.text });
      const finish = (reply: string) => {
        appendMessage(p.conversationId, { role: "assistant", content: reply });
        p.emit({ type: "delta", text: reply });
        p.emit({ type: "done" });
      };
      if (!research) return finish("Use assim: `/pesquisa <tema>`. O Zenith faz várias buscas na web, lê as páginas e escreve um relatório com citações numeradas e a lista de fontes.");
      if (p.toolFlags && p.toolFlags.web === false) return finish("A pesquisa na web está desligada nesta conversa. Ligue em Ferramentas (ícone abaixo da caixa de texto).");
      const ask = async (sys: string, user: string, onDelta?: (t: string) => void): Promise<string> => {
        const r = await streamChat({ provider, model, messages: [{ role: "system", content: sys }, { role: "user", content: user }], tools: [], signal: p.signal, onDelta: onDelta ?? (() => undefined), temperature: Math.min(settings.temperature, 0.5), topP: settings.topP, maxTokens: Math.max(settings.maxTokens, 2048) });
        return r.content;
      };
      const out = await deepResearch({ topic: research[1].trim(), settings, compact: provider.kind === "native", signal: p.signal, emit: p.emit, ask });
      const tail = sourcesMarkdown(out.sources);
      if (tail) p.emit({ type: "delta", text: tail });
      // Guarda as buscas e leituras como chamadas de ferramenta (aparecem recolhidas) e depois o relatório.
      if (out.steps.length) {
        appendMessage(p.conversationId, { role: "assistant", content: "", toolCalls: out.steps.map((s) => s.call) });
        for (const s of out.steps) appendMessage(p.conversationId, { role: "tool", content: s.output, toolCallId: s.call.id, toolName: s.call.name });
      }
      appendMessage(p.conversationId, { role: "assistant", content: out.report + tail });
      p.emit({ type: "done" });
      return;
    }
    // Comando /compact: resume a conversa antiga e guarda o resumo para os próximos turnos.
    if (userText.trim() === "/compact") {
      appendMessage(p.conversationId, { role: "user", content: p.text });
      const reply = await compactConversation(p.conversationId, provider, model, p.signal, (t) => p.emit({ type: "delta", text: t }));
      appendMessage(p.conversationId, { role: "assistant", content: reply });
      p.emit({ type: "delta", text: `\n\n${reply}` });
      p.emit({ type: "done" });
      return;
    }

    const firstTurn = listMessages(p.conversationId).length === 0;
    if (firstTurn) await runHooks("SessionStart", "", {}, settings.workspace);
    // Comando /init: pede ao agente que crie o arquivo de instruções do projeto.
    const effectiveText = userText.trim() === "/init"
      ? "Analise a pasta de trabalho (estrutura, README, scripts) e crie o arquivo ZENITH.md com: o que é o projeto, como rodar, como testar e convenções. Use list_dir e read_file antes de escrever."
      : p.text;

    appendMessage(p.conversationId, { role: "user", content: p.text });
    const compact = getKv<{ count: number; summary: string } | null>(`compact:${p.conversationId}`, null);
    const all = toChat(listMessages(p.conversationId));
    const history = all.slice(compact ? compact.count : 0).slice(-HISTORY_LIMIT);
    const system = systemPrompt(settings, mode, skills);
    const messages: ChatMessage[] = [{ role: "system", content: system }, ...history];
    if (compact) messages.splice(1, 0, { role: "system", content: `Resumo da conversa anterior:\n${compact.summary}` });
    if (effectiveText !== p.text) messages[messages.length - 1] = { role: "user", content: effectiveText };
    const projectCtx = projectContext(p.conversationId, p.text);
    if (projectCtx) messages.splice(1, 0, { role: "system", content: projectCtx });
    if (skillContext) messages.push({ role: "system", content: `Skill acionada pelo usuário:\n${skillContext}` });
    await ensureServers(settings.workspace);
    const flags = { ...ALL_FLAGS, ...(p.toolFlags ?? {}) };
    const tools: ToolSpec[] = [...TOOLS.map(({ risk: _r, ...spec }) => spec), LOAD_SKILL_TOOL, ...mcpTools(), DELEGATE_TOOL, REMEMBER_TOOL]
      .filter((t) => {
        const f = flagFor(t.name);
        return !f || flags[f];
      });

    const useThinking = !!settings.reasoning && provider?.kind === "native";
    p.delegate = (task) => runSubagent(task, provider, model, settings, skills, flags, p);
    for (let step = 0; step < MAX_STEPS; step++) {
      if (p.signal.aborted) break;
      const result = await streamChat({
        provider,
        model,
        messages,
        tools,
        signal: p.signal,
        onDelta: (text) => p.emit({ type: "delta", text }),
        onThinking: (text) => p.emit({ type: "thinking", text }),
        thinking: useThinking,
        temperature: settings.temperature,
        topP: settings.topP,
        // O raciocínio gasta tokens antes da resposta: dá mais espaço quando está ligado.
        maxTokens: useThinking ? Math.max(settings.maxTokens, 4096) : settings.maxTokens,
      });

      const stored = appendMessage(p.conversationId, {
        role: "assistant",
        // O raciocínio fica guardado na frente da resposta, entre <think> e </think>.
        content: result.thinking ? `<think>${result.thinking}</think>\n\n${result.content}` : result.content,
        toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
      });
      messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls.length ? result.toolCalls : undefined });
      void stored;

      if (result.toolCalls.length === 0) break;

      for (const call of result.toolCalls) {
        if (p.signal.aborted) break;
        p.emit({ type: "tool_start", id: call.id, name: call.name, args: call.args });
        const out = await handleToolCall(call.name, call.args, call.id, mode, settings, skills, p);
        p.emit({ type: "tool_result", id: call.id, name: call.name, ok: out.ok, output: out.output });
        appendMessage(p.conversationId, { role: "tool", content: out.output, toolCallId: call.id, toolName: call.name });
        messages.push({ role: "tool", content: out.output, toolCallId: call.id, toolName: call.name });
      }
    }
    await runHooks("Stop", "", {}, settings.workspace);
    p.emit({ type: "done" });
  } catch (err) {
    p.emit({ type: "error", message: (err as Error).message });
    p.emit({ type: "done" });
  }
}

/** Resume as mensagens antigas (exceto as 4 últimas) com o próprio modelo, sem ferramentas. */
async function compactConversation(
  conversationId: string,
  provider: ProviderConfig | undefined,
  model: string,
  signal: AbortSignal,
  onDelta: (t: string) => void,
): Promise<string> {
  if (!provider) return "Não há provedor ativo para compactar.";
  const rows = toChat(listMessages(conversationId));
  const keep = 4;
  if (rows.length <= keep + 2) return "Conversa curta demais para compactar.";
  const old = rows.slice(0, rows.length - keep);
  const transcript = old
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Usuário" : "Zenith"}: ${m.content.slice(0, 1500)}`)
    .join("\n");
  const result = await streamChat({
    provider,
    model,
    messages: [
      { role: "system", content: "Resuma a conversa abaixo em até 12 linhas. Mantenha fatos, decisões, arquivos citados e pendências. Responda só com o resumo, em português." },
      { role: "user", content: transcript },
    ],
    tools: [],
    signal,
    onDelta,
  });
  setKv(`compact:${conversationId}`, { count: old.length, summary: result.content });
  return `Contexto compactado: ${old.length} mensagens resumidas. As 4 últimas foram mantidas.`;
}

/** Subagente: contexto novo, só leitura, até 8 passos. Devolve o resumo final ao agente principal. */
async function runSubagent(task: string, provider: ProviderConfig | undefined, model: string, settings: Settings, skills: Skill[], flags: ToolFlags, p: TurnParams): Promise<string> {
  if (!provider) return "Não há provedor ativo para o subagente.";
  const tools: ToolSpec[] = TOOLS.filter((t) => SUBAGENT_TOOLS.has(t.name))
    .map(({ risk: _r, ...spec }) => spec)
    .filter((t) => { const f = flagFor(t.name); return !f || flags[f]; });
  const messages: ChatMessage[] = [
    { role: "system", content: `Você é um subagente de pesquisa do Zenith Code. Cumpra a tarefa usando só as ferramentas de leitura e responda no fim com um resumo curto e objetivo do que encontrou (caminhos de arquivo, fatos, conclusões). Você não pode alterar nada.\nPasta de trabalho: ${settings.workspace}` },
    { role: "user", content: task },
  ];
  p.emit({ type: "status", text: "Subagente iniciado" });
  let last = "";
  for (let step = 0; step < SUBAGENT_STEPS; step++) {
    if (p.signal.aborted) break;
    const result = await streamChat({ provider, model, messages, tools, signal: p.signal, onDelta: () => undefined, temperature: settings.temperature, topP: settings.topP, maxTokens: settings.maxTokens });
    last = result.content || last;
    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls.length ? result.toolCalls : undefined });
    if (result.toolCalls.length === 0) break;
    for (const call of result.toolCalls) {
      const allowed = SUBAGENT_TOOLS.has(call.name);
      const out = allowed ? await handleToolCall(call.name, call.args, call.id, "plan", settings, skills, { ...p, toolFlags: flags }) : { ok: false, output: "Ferramenta não permitida para subagentes." };
      messages.push({ role: "tool", content: out.output.slice(0, 6000), toolCallId: call.id, toolName: call.name });
    }
  }
  p.emit({ type: "status", text: "Subagente concluído" });
  return last.trim() || "O subagente terminou sem resposta.";
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  callId: string,
  mode: Mode,
  settings: Settings,
  skills: Skill[],
  p: TurnParams,
): Promise<{ ok: boolean; output: string }> {
  if (name === "remember") {
    const fact = String(args.fact ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!fact) return { ok: false, output: "Informe o que lembrar." };
    if (mode === "plan") return { ok: false, output: "Modo plano: a memória não é alterada." };
    const file = memoryPath(settings.workspace);
    const current = memoryText(settings.workspace);
    if (current.split("\n").some((l) => l.replace(/^[-*]\s*/, "").trim().toLowerCase() === fact.toLowerCase())) return { ok: true, output: "Já estava na memória." };
    if (current.length + fact.length > 3800) return { ok: false, output: "A memória está cheia. Peça ao usuário para limpar em Configurações > Memória." };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${current ? current + "\n" : ""}- ${fact}\n`, "utf8");
    return { ok: true, output: `Guardado na memória: ${fact}` };
  }
  if (name === "delegate_task") {
    const task = String(args.task ?? "").trim();
    if (!task) return { ok: false, output: "Informe a tarefa do subagente." };
    if (!p.delegate) return { ok: false, output: "Subagentes não estão disponíveis aqui." };
    return { ok: true, output: await p.delegate(task) };
  }
  if (name === "load_skill") {
    const skill = skills.find((s) => s.name === String(args.name ?? ""));
    return skill ? { ok: true, output: skill.body } : { ok: false, output: "Skill não encontrada." };
  }
  const f = flagFor(name);
  if (f && p.toolFlags && !p.toolFlags[f]) return { ok: false, output: "Ferramenta desligada nesta conversa (ver o seletor de ferramentas)." };
  const isMcp = name.startsWith("mcp__");
  const def = TOOLS.find((t) => t.name === name);
  if (!def && !isMcp) return { ok: false, output: `Ferramenta desconhecida: ${name}` };
  const risk: Risk = isMcp ? "exec" : def!.risk;

  const pre = await runHooks("PreToolUse", name, args, settings.workspace);
  if (pre.block) return { ok: false, output: `Bloqueado por hook: ${pre.reason}` };

  const verdict = await decide(name, args, risk, mode, settings, callId, p);
  if (verdict === "blocked-plan") return { ok: false, output: "Bloqueado: o modo plano não altera arquivos nem executa comandos. Apresente o plano e peça aprovação para trocar de modo." };
  if (verdict === "deny") return { ok: false, output: "Ação negada pelo usuário." };

  const checkpoint = (name === "write_file" || name === "edit_file") ? snapshot(name, args, settings) : null;
  const result = isMcp ? await callMcpTool(name, args) : await executeTool(name, args, settings);
  if (result.ok && checkpoint) {
    let after: string | null = null;
    try {
      after = fs.readFileSync(resolveInside(settings.workspace, checkpoint.relPath), "utf8");
    } catch {
      after = null;
    }
    addCheckpoint({ conversationId: p.conversationId, ...checkpoint, base: settings.workspace, toolCallId: callId, after });
  }
  void runHooks("PostToolUse", name, args, settings.workspace);
  return result;
}

async function decide(
  name: string,
  args: Record<string, unknown>,
  risk: Risk,
  mode: Mode,
  settings: Settings,
  callId: string,
  p: TurnParams,
): Promise<"allow" | "deny" | "blocked-plan"> {
  if (risk === "read") return "allow";
  if (mode === "plan") return "blocked-plan";
  if (mode === "bypass") return "allow";
  if (mode === "accept_edits" && risk === "write") return "allow";

  const key = permissionKey(name, args);
  if (settings.alwaysAllow.includes(key)) return "allow";

  const id = randomUUID();
  p.emit({ type: "permission", id, name, risk, summary: describeAction(name, args), args });
  const decision: Decision = await requestPermission(id, p.signal);
  if (decision === "always") {
    const latest = getSettings();
    if (!latest.alwaysAllow.includes(key)) {
      latest.alwaysAllow.push(key);
      saveSettings(latest);
      settings.alwaysAllow = latest.alwaysAllow;
    }
    return "allow";
  }
  void callId;
  return decision === "once" ? "allow" : "deny";
}

/** Caminho da memória global (editável pelo usuário na tela de configurações). */
export function memoryPath(workspace: string): string {
  return path.join(workspace, ".zenith", "memoria.md");
}

export function memoryText(workspace: string): string {
  try {
    return fs.readFileSync(memoryPath(workspace), "utf8").slice(0, 4000).trim();
  } catch {
    return "";
  }
}

/** Instruções do projeto e trechos relevantes dos arquivos de referência (recuperação por palavras). */
export function projectContext(conversationId: string, query: string): string {
  const projectId = conversationProjectId(conversationId);
  if (!projectId) return "";
  const project = getProject(projectId);
  if (!project) return "";
  const parts: string[] = [`Projeto atual: ${project.name}`];
  if (project.instructions.trim()) parts.push(`Instruções do projeto:\n${project.instructions.trim()}`);
  const files = listProjectFiles(projectId);
  if (files.length) {
    const words = new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));
    const chunks: { score: number; text: string }[] = [];
    for (const f of files) {
      for (let i = 0; i < f.content.length; i += 1200) {
        const text = f.content.slice(i, i + 1200);
        const lower = text.toLowerCase();
        let score = 0;
        for (const w of words) if (lower.includes(w)) score++;
        chunks.push({ score, text: `[${f.name}]\n${text}` });
      }
    }
    const top = chunks.sort((a, b) => b.score - a.score).slice(0, 5).filter((c) => c.score > 0 || chunks.length <= 5);
    if (top.length) parts.push(`Trechos dos arquivos de referência do projeto:\n${top.map((c) => c.text).join("\n---\n")}`);
  }
  return parts.join("\n\n");
}

/** Captura o conteúdo anterior do arquivo para permitir desfazer. */
function snapshot(_name: string, args: Record<string, unknown>, settings: Settings): { relPath: string; previous: string | null; existed: boolean } | null {
  try {
    const abs = resolveInside(settings.workspace, String(args.path ?? ""));
    const existed = fs.existsSync(abs);
    return { relPath: String(args.path), previous: existed ? fs.readFileSync(abs, "utf8") : null, existed };
  } catch {
    return null;
  }
}

// Atalhos de comando que apontam para uma skill (ex.: /review usa a skill code-review).
const COMMAND_ALIASES: Record<string, string> = { review: "code-review" };

/** Comando "/nome args": injeta a skill e substitui $ARGUMENTS pelo texto digitado depois do nome. */
function applySkillCommand(text: string, skills: Skill[]): { text: string; skillContext: string } {
  const m = /^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return { text, skillContext: "" };
  const name = COMMAND_ALIASES[m[1]] ?? m[1];
  const skill = skills.find((s) => s.name === name);
  if (!skill) return { text, skillContext: "" };
  const args = m[2] ?? "";
  return { text: args || text, skillContext: skill.body.split("$ARGUMENTS").join(args) };
}

function toChat(rows: ReturnType<typeof listMessages>): ChatMessage[] {
  return rows.map((r) => ({
    role: r.role,
    content: r.role === "assistant" ? stripThinking(r.content) : r.content,
    toolCalls: r.toolCalls,
    toolCallId: r.toolCallId,
    toolName: r.toolName,
  }));
}

/** Texto do prompt "jailbreak" (prompts/jailbreak.md, na pasta do programa). */
export function jailbreakText(): string {
  try {
    return fs.readFileSync(path.join(APP_ROOT, "prompts", "jailbreak.md"), "utf8").trim();
  } catch {
    return "";
  }
}

export function systemPrompt(settings: Settings, mode: Mode, skills: Skill[]): string {
  const modeText: Record<Mode, string> = {
    ask: "Modo perguntar: leituras são livres; escrita, comandos e acesso à web pedem aprovação.",
    accept_edits: "Modo aceitar edições: escrita de arquivos é automática; comandos e web pedem aprovação.",
    plan: "Modo plano: somente leitura. Monte um plano claro e peça aprovação antes de alterar algo.",
    bypass: "Modo sem aprovação: todas as ferramentas rodam sem perguntar. Aja com cuidado.",
  };
  return [
    "Você é o Zenith Code 1.0, um assistente de programação e de trabalho que roda no computador do usuário.",
    "Responda no idioma em que o usuário escreveu. Seja direto e prático.",
    ({
      normal: "Estilo: equilibrado.",
      conciso: "Estilo: conciso. Respostas curtas, sem rodeios.",
      detalhado: "Estilo: detalhado. Explique o raciocínio e liste os passos.",
      didatico: "Estilo: didático. Use exemplos simples e defina termos técnicos.",
    } as Record<string, string>)[settings.responseStyle] ?? "Estilo: equilibrado.",
    ...(settings.customPrompt?.trim() ? [`Instruções do usuário (Configurações):\n${settings.customPrompt.trim()}`] : []),
    ...(settings.jailbreak && jailbreakText() ? [jailbreakText()] : []),
    "Use as ferramentas para ler antes de alterar arquivos. Ao editar, prefira edit_file a reescrever o arquivo inteiro.",
    "Os caminhos de arquivo são relativos à pasta de trabalho. Nunca tente sair dela.",
    `Pasta de trabalho: ${settings.workspace}`,
    `Data: ${new Date().toISOString().slice(0, 10)}`,
    modeText[mode],
    ...(memoryText(settings.workspace) ? ["Memória do usuário (fatos e preferências que ele pediu para lembrar):", memoryText(settings.workspace)] : []),
    "Skills instaladas (use load_skill para ler as instruções completas):",
    skillsIndex(skills),
  ].join("\n");
}
