// Loop do agente: envia o histórico ao modelo, executa ferramentas com permissão e repete até a resposta final.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ChatMessage, Mode, ProviderConfig, Settings, StreamEvent, ToolSpec } from "./types.ts";
import { addCheckpoint, appendMessage, conversationFolder, conversationProjectId, getKv, getProject, getSettings, listMessages, listProjectFiles, saveSettings, setKv } from "./store.ts";
import { streamChat } from "./providers.ts";
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
    const tools: ToolSpec[] = [...TOOLS.map(({ risk: _r, ...spec }) => spec), LOAD_SKILL_TOOL, ...mcpTools()]
      .filter((t) => {
        const f = flagFor(t.name);
        return !f || flags[f];
      });

    for (let step = 0; step < MAX_STEPS; step++) {
      if (p.signal.aborted) break;
      const result = await streamChat({
        provider,
        model,
        messages,
        tools,
        signal: p.signal,
        onDelta: (text) => p.emit({ type: "delta", text }),
        temperature: settings.temperature,
        topP: settings.topP,
        maxTokens: settings.maxTokens,
      });

      const stored = appendMessage(p.conversationId, {
        role: "assistant",
        content: result.content,
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

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  callId: string,
  mode: Mode,
  settings: Settings,
  skills: Skill[],
  p: TurnParams,
): Promise<{ ok: boolean; output: string }> {
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
    content: r.content,
    toolCalls: r.toolCalls,
    toolCallId: r.toolCallId,
    toolName: r.toolName,
  }));
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
