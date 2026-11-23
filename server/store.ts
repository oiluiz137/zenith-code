// Persistência local em SQLite (node:sqlite, nativo do Node 22). Nada sai do computador.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import type { Conversation, Settings, StoredMessage, ToolCall, Role, ProviderConfig } from "./types.ts";

const DATA_DIR = path.resolve(process.cwd(), ".zenith-data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "zenith.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, seq);
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export const dataDir = DATA_DIR;

// Migrações leves: tipo de sessão (chat, cowork, code) e pasta de trabalho por conversa.
for (const sql of [
  "ALTER TABLE conversations ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'",
  "ALTER TABLE conversations ADD COLUMN folder TEXT",
]) {
  try {
    db.exec(sql);
  } catch {
    // coluna já existe
  }
}

export function listConversations(): Conversation[] {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c ORDER BY c.pinned DESC, c.updated_at DESC
  `).all() as any[];
  return rows.map(toConversation);
}

export function getConversation(id: string): Conversation | undefined {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as any;
  return row ? toConversation(row) : undefined;
}

export type SessionKind = "chat" | "cowork" | "code";

export function createConversation(title = "Nova conversa", kind: SessionKind = "chat", folder: string | null = null): Conversation {
  const now = Date.now();
  const id = randomUUID();
  db.prepare("INSERT INTO conversations (id, title, pinned, created_at, updated_at, kind, folder) VALUES (?, ?, 0, ?, ?, ?, ?)").run(id, title, now, now, kind, folder);
  return { id, title, pinned: false, kind, folder, createdAt: now, updatedAt: now };
}

export function updateConversation(id: string, patch: { title?: string; pinned?: boolean; folder?: string | null }): void {
  if (patch.title !== undefined) db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(patch.title, id);
  if (patch.pinned !== undefined) db.prepare("UPDATE conversations SET pinned = ? WHERE id = ?").run(patch.pinned ? 1 : 0, id);
  if (patch.folder !== undefined) db.prepare("UPDATE conversations SET folder = ? WHERE id = ?").run(patch.folder, id);
}

/** Pasta de trabalho da conversa: pasta própria, depois a do projeto, depois a padrão. */
export function conversationFolder(conversationId: string): string | null {
  const r = db.prepare(`
    SELECT c.folder AS folder, p.folder AS project_folder
    FROM conversations c LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.id = ?
  `).get(conversationId) as any;
  return r?.folder ?? r?.project_folder ?? null;
}

export function deleteConversation(id: string): void {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

export function touchConversation(id: string): void {
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

export function listMessages(conversationId: string): StoredMessage[] {
  const rows = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq ASC").all(conversationId) as any[];
  return rows.map((r) => {
    const data = r.data ? JSON.parse(r.data) : {};
    return {
      id: r.id,
      role: r.role as Role,
      content: r.content,
      toolCalls: data.toolCalls,
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      createdAt: r.created_at,
    } satisfies StoredMessage;
  });
}

export function appendMessage(conversationId: string, msg: { role: Role; content: string; toolCalls?: ToolCall[]; toolCallId?: string; toolName?: string }): StoredMessage {
  const seqRow = db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM messages WHERE conversation_id = ?").get(conversationId) as any;
  const id = randomUUID();
  const now = Date.now();
  const extra = msg.toolCalls || msg.toolCallId || msg.toolName ? JSON.stringify({ toolCalls: msg.toolCalls, toolCallId: msg.toolCallId, toolName: msg.toolName }) : null;
  db.prepare("INSERT INTO messages (id, conversation_id, seq, role, content, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, conversationId, seqRow.next, msg.role, msg.content, extra, now);
  touchConversation(conversationId);
  return { id, ...msg, createdAt: now };
}

export function searchConversations(q: string): { conversationId: string; title: string; snippet: string }[] {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = db.prepare(`
    SELECT c.id AS conversationId, c.title AS title, m.content AS snippet
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.content LIKE ? OR c.title LIKE ?
    ORDER BY c.updated_at DESC LIMIT 30
  `).all(like, like) as any[];
  return rows.map((r) => ({ conversationId: r.conversationId, title: r.title, snippet: String(r.snippet).slice(0, 160) }));
}

/** Respostas do assistente que contêm blocos HTML (artefatos), da mais recente para a mais antiga. */
export function listArtifactMessages(): { conversationId: string; title: string; messageId: string; content: string; createdAt: number }[] {
  const rows = db.prepare(`
    SELECT c.id AS conversationId, c.title AS title, m.id AS messageId, m.content AS content, m.created_at AS createdAt
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.role = 'assistant' AND m.content LIKE '%\`\`\`html%'
    ORDER BY m.created_at DESC LIMIT 200
  `).all() as any[];
  return rows.map((r) => ({ conversationId: r.conversationId, title: r.title, messageId: r.messageId, content: String(r.content), createdAt: Number(r.createdAt) }));
}

export function getKv<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as any;
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export function setKv(key: string, value: unknown): void {
  db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
}

db.exec(`
  CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    previous TEXT,
    existed INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Colunas acrescentadas depois da primeira versão (bancos antigos recebem as colunas aqui).
for (const col of ["base TEXT", "tool_call_id TEXT", "after TEXT", "status TEXT NOT NULL DEFAULT 'applied'"]) {
  try {
    db.exec(`ALTER TABLE checkpoints ADD COLUMN ${col}`);
  } catch {
    /* coluna já existe */
  }
}

export type CheckpointStatus = "applied" | "reverted" | "partial" | "accepted";

export interface Checkpoint {
  id: string;
  conversationId: string;
  relPath: string;
  previous: string | null;
  existed: boolean;
  /** Pasta de trabalho em que a edição aconteceu (null em checkpoints antigos). */
  base: string | null;
  toolCallId: string | null;
  after: string | null;
  status: CheckpointStatus;
  createdAt: number;
}

function rowToCheckpoint(r: any): Checkpoint {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    relPath: r.rel_path,
    previous: r.previous,
    existed: !!r.existed,
    base: r.base ?? null,
    toolCallId: r.tool_call_id ?? null,
    after: r.after ?? null,
    status: (r.status ?? "applied") as CheckpointStatus,
    createdAt: r.created_at,
  };
}

/** Guarda o conteúdo antes e depois de uma alteração do agente. */
export function addCheckpoint(c: { conversationId: string; relPath: string; previous: string | null; existed: boolean; base?: string; toolCallId?: string; after?: string | null }): void {
  db.prepare("INSERT INTO checkpoints (id, conversation_id, rel_path, previous, existed, base, tool_call_id, after, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?)")
    .run(randomUUID(), c.conversationId, c.relPath, c.previous, c.existed ? 1 : 0, c.base ?? null, c.toolCallId ?? null, c.after ?? null, Date.now());
}

export function listCheckpoints(limit = 20): Checkpoint[] {
  const rows = db.prepare("SELECT * FROM checkpoints ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
  return rows.map(rowToCheckpoint);
}

export function listConversationCheckpoints(conversationId: string): Checkpoint[] {
  const rows = db.prepare("SELECT * FROM checkpoints WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId) as any[];
  return rows.map(rowToCheckpoint);
}

export function getCheckpoint(id: string): Checkpoint | undefined {
  const r = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id);
  return r ? rowToCheckpoint(r) : undefined;
}

export function setCheckpointStatus(id: string, status: CheckpointStatus, after?: string | null): void {
  if (after === undefined) db.prepare("UPDATE checkpoints SET status = ? WHERE id = ?").run(status, id);
  else db.prepare("UPDATE checkpoints SET status = ?, after = ? WHERE id = ?").run(status, after, id);
}

/** Remove e devolve o checkpoint aplicado mais recente (botão Desfazer). */
export function popCheckpoint(): Checkpoint | undefined {
  const r = db.prepare("SELECT * FROM checkpoints WHERE status = 'applied' ORDER BY created_at DESC LIMIT 1").get();
  const last = r ? rowToCheckpoint(r) : undefined;
  if (last) db.prepare("DELETE FROM checkpoints WHERE id = ?").run(last.id);
  return last;
}

// ---------- Projetos: instruções, arquivos de referência e memória ----------

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
try {
  db.exec("ALTER TABLE conversations ADD COLUMN project_id TEXT");
} catch {
  // coluna já existe
}

try {
  db.exec("ALTER TABLE projects ADD COLUMN folder TEXT");
} catch {
  // coluna já existe
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  folder: string | null;
  createdAt: number;
}

export function listProjects(): Project[] {
  return (db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as any[]).map(toProject);
}

export function getProject(id: string): Project | undefined {
  const r = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  return r ? toProject(r) : undefined;
}

export function createProject(name: string, instructions = "", folder: string | null = null): Project {
  const id = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO projects (id, name, instructions, created_at, folder) VALUES (?, ?, ?, ?, ?)").run(id, name, instructions, now, folder);
  return { id, name, instructions, folder, createdAt: now };
}

export function updateProject(id: string, patch: { name?: string; instructions?: string; folder?: string | null }): void {
  if (patch.name !== undefined) db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(patch.name, id);
  if (patch.instructions !== undefined) db.prepare("UPDATE projects SET instructions = ? WHERE id = ?").run(patch.instructions, id);
  if (patch.folder !== undefined) db.prepare("UPDATE projects SET folder = ? WHERE id = ?").run(patch.folder, id);
}

export function deleteProject(id: string): void {
  db.prepare("DELETE FROM project_files WHERE project_id = ?").run(id);
  db.prepare("UPDATE conversations SET project_id = NULL WHERE project_id = ?").run(id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function setConversationProject(conversationId: string, projectId: string | null): void {
  db.prepare("UPDATE conversations SET project_id = ? WHERE id = ?").run(projectId, conversationId);
}

export function conversationProjectId(conversationId: string): string | null {
  const r = db.prepare("SELECT project_id FROM conversations WHERE id = ?").get(conversationId) as any;
  return r?.project_id ?? null;
}

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  content: string;
}

export function listProjectFiles(projectId: string): ProjectFile[] {
  return (db.prepare("SELECT id, name, content FROM project_files WHERE project_id = ? ORDER BY created_at ASC").all(projectId) as any[])
    .map((r) => ({ id: r.id, name: r.name, size: r.content.length, content: r.content }));
}

export function addProjectFile(projectId: string, name: string, content: string): void {
  db.prepare("INSERT INTO project_files (id, project_id, name, content, created_at) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), projectId, name, content, Date.now());
}

export function deleteProjectFile(id: string): void {
  db.prepare("DELETE FROM project_files WHERE id = ?").run(id);
}

/** Remove mensagens a partir de uma posição (usado por "editar e reenviar"). */
export function truncateMessages(conversationId: string, fromSeq: number): void {
  db.prepare("DELETE FROM messages WHERE conversation_id = ? AND seq >= ?").run(conversationId, fromSeq);
}

export function messageSeq(messageId: string): number | undefined {
  const r = db.prepare("SELECT seq FROM messages WHERE id = ?").get(messageId) as any;
  return r?.seq;
}

function toProject(r: any): Project {
  return { id: r.id, name: r.name, instructions: r.instructions, folder: r.folder ?? null, createdAt: r.created_at };
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "local", kind: "native", name: "Modelo local (nativo, GGUF)", baseUrl: "", enabled: true },
  { id: "openai", kind: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", enabled: false },
  { id: "openrouter", kind: "openai", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", enabled: false },
  { id: "anthropic", kind: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com", enabled: false },
];

/** Provedores que dependiam de servidor externo (Ollama, LM Studio) e foram removidos da 1.0. */
const LEGACY_PROVIDER_IDS = ["ollama", "lmstudio"];

export function getSettings(): Settings {
  const defaults: Settings = {
    providers: DEFAULT_PROVIDERS,
    defaultProvider: "local",
    defaultModel: "Qwen3-8B-Q4_K_M.gguf",
    workspace: path.resolve(process.cwd(), "workspace"),
    mode: "ask",
    searxngUrl: "",
    alwaysAllow: [],
    temperature: 0.7,
    topP: 0.8,
    responseStyle: "normal",
    maxTokens: 2048,
    customPrompt: "",
  };
  const saved = getKv<Partial<Settings>>("settings", {});
  const merged = { ...defaults, ...saved };
  // Remove provedores legados e garante que os provedores padrão existam.
  merged.providers = merged.providers.filter((p) => !LEGACY_PROVIDER_IDS.includes(p.id));
  const ids = new Set(merged.providers.map((p) => p.id));
  for (const p of DEFAULT_PROVIDERS) if (!ids.has(p.id)) merged.providers.push(p);
  if (LEGACY_PROVIDER_IDS.includes(merged.defaultProvider)) merged.defaultProvider = "local";
  fs.mkdirSync(merged.workspace, { recursive: true });
  return merged;
}

export function saveSettings(s: Settings): void {
  setKv("settings", s);
}

function toConversation(r: any): Conversation {
  return {
    id: r.id,
    title: r.title,
    pinned: !!r.pinned,
    projectId: r.project_id ?? null,
    kind: (r.kind ?? "chat") as SessionKind,
    folder: r.folder ?? null,
    messageCount: r.message_count ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
