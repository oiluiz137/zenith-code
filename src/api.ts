// Cliente da API local do Zenith Code 1.0.
import type { Conversation, Mode, ProviderConfig, Settings, StoredMessage, StreamEvent } from "../server/types";

export interface Project {
  id: string;
  name: string;
  instructions: string;
  folder: string | null;
  createdAt: number;
}

export interface AgentEdit {
  id: string;
  relPath: string;
  toolCallId: string | null;
  status: "applied" | "reverted" | "partial" | "accepted";
  existed: boolean;
  createdAt: number;
  reviewable: boolean;
  stale: boolean;
  added: number;
  removed: number;
  hunks: { index: number; oldStart: number; newStart: number; lines: string[] }[];
}

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  repeat: "once" | "hourly" | "daily" | "weekly";
  time: string;
  enabled: boolean;
  mode: Mode;
  folder: string | null;
  nextRun: number | null;
  lastRun: number | null;
  lastStatus: "ok" | "erro" | "executando" | null;
  lastConversationId: string | null;
  createdAt: number;
}

export interface Bootstrap {
  name: string;
  version: string;
  settings: Settings;
  conversations: Conversation[];
  skills: { name: string; description: string }[];
  hooks: Record<string, unknown>;
}

/** Ponte do app de desktop (Electron); ausente quando o Zenith roda no navegador. */
export const desktop = (window as unknown as { zenithDesktop?: { isDesktop: true; platform: string; pickFolder: (title?: string) => Promise<string | null>; openPath: (p: string) => Promise<string> } }).zenithDesktop;

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json as T;
}

export const api = {
  bootstrap: () => call<Bootstrap>("GET", "/api/bootstrap"),
  conversations: () => call<Conversation[]>("GET", "/api/conversations"),
  createConversation: (title?: string, kind: "chat" | "cowork" | "code" = "chat", folder?: string | null) =>
    call<Conversation>("POST", "/api/conversations", { title, kind, folder: folder ?? null }),
  // No app de desktop usa o seletor nativo do sistema; no navegador, o do servidor.
  pickFolder: async (): Promise<{ path: string | null; error?: string }> => {
    if (desktop) return { path: await desktop.pickFolder() };
    return call<{ path: string | null; error?: string }>("POST", "/api/pick-folder");
  },
  gitStatus: (conversationId?: string) =>
    call<{ folder: string; isRepo: boolean; branch?: string; files: { status: string; path: string }[]; error?: string }>(
      "GET", `/api/git/status${conversationId ? `?conversationId=${conversationId}` : ""}`),
  gitDiff: (path: string, conversationId?: string) =>
    call<{ ok: boolean; diff: string }>("GET", `/api/git/diff?path=${encodeURIComponent(path)}${conversationId ? `&conversationId=${conversationId}` : ""}`),
  context: (conversationId: string) =>
    call<{ limit: number; used: number; exact?: boolean; categories: { label: string; tokens: number }[] }>("GET", `/api/context?conversationId=${conversationId}`),
  jobs: () => call<{ id: string; command: string; cwd: string; status: string; output: string; startedAt: number }[]>("GET", "/api/jobs"),
  startJob: (command: string, conversationId?: string) => call<{ id: string }>("POST", "/api/jobs", { command, conversationId }),
  stopJob: (id: string) => call<{ ok: boolean }>("POST", `/api/jobs/${id}/stop`),
  getConversation: (id: string) => call<{ conversation: Conversation; messages: StoredMessage[] }>("GET", `/api/conversations/${id}`),
  updateConversation: (id: string, patch: { title?: string; pinned?: boolean; projectId?: string | null; folder?: string | null }) => call<Conversation>("PATCH", `/api/conversations/${id}`, patch),
  deleteConversation: (id: string) => call<{ ok: boolean }>("DELETE", `/api/conversations/${id}`),
  skillFile: (name: string) => call<{ content: string; origin: "projeto" | "app" }>("GET", `/api/skills/${encodeURIComponent(name)}`),
  saveSkill: (name: string, content: string) => call<{ ok: boolean }>("PUT", `/api/skills/${encodeURIComponent(name)}`, { content }),
  deleteSkill: (name: string) => call<{ ok: boolean }>("DELETE", `/api/skills/${encodeURIComponent(name)}`),
  jailbreakText: () => call<{ text: string }>("GET", "/api/jailbreak"),
  modelsDir: (open = false) => call<{ path: string }>(open ? "POST" : "GET", "/api/models-dir"),
  edits: (conversationId: string) => call<AgentEdit[]>("GET", `/api/edits?conversationId=${encodeURIComponent(conversationId)}`),
  revertEdit: (id: string, hunks?: number[]) => call<{ ok: boolean; message: string }>("POST", `/api/edits/${id}/revert`, hunks ? { hunks } : {}),
  acceptEdit: (id: string) => call<{ ok: boolean; message: string }>("POST", `/api/edits/${id}/accept`, {}),
  schedules: () => call<ScheduledTask[]>("GET", "/api/schedules"),
  createSchedule: (t: Partial<ScheduledTask> & { prompt: string }) => call<ScheduledTask>("POST", "/api/schedules", t),
  updateSchedule: (id: string, patch: Partial<ScheduledTask>) => call<ScheduledTask>("PATCH", `/api/schedules/${id}`, patch),
  deleteSchedule: (id: string) => call<{ ok: boolean }>("DELETE", `/api/schedules/${id}`),
  runSchedule: (id: string) => call<{ ok: boolean }>("POST", `/api/schedules/${id}/run`),
  disabledSkills: () => call<string[]>("GET", "/api/skills-disabled"),
  setDisabledSkills: (names: string[]) => call<string[]>("PUT", "/api/skills-disabled", { names }),
  exportAllUrl: "/api/export-all",
  artifacts: () => call<{ conversationId: string; title: string; messageId: string; content: string; createdAt: number }[]>("GET", "/api/artifacts"),
  search: (q: string) => call<{ conversationId: string; title: string; snippet: string }[]>("GET", `/api/search?q=${encodeURIComponent(q)}`),
  saveSettings: (s: Partial<Settings> & { providers?: ProviderConfig[] }) => call<Settings>("PUT", "/api/settings", s),
  models: (provider: string) => call<{ models: string[]; error?: string }>("GET", `/api/models?provider=${encodeURIComponent(provider)}`),
  permission: (id: string, decision: "once" | "always" | "deny") => call<{ ok: boolean }>("POST", `/api/permissions/${id}`, { decision }),
  undo: () => call<{ ok: boolean; message: string }>("POST", "/api/checkpoints/undo"),
  feedback: () => call<Record<string, string>>("GET", "/api/feedback"),
  setFeedback: (messageId: string, value: "up" | "down" | null) => call<Record<string, string>>("POST", "/api/feedback", { messageId, value }),
  memory: () => call<{ content: string }>("GET", "/api/memory"),
  saveMemory: (content: string) => call<{ ok: boolean }>("PUT", "/api/memory", { content }),
  mcp: () => call<{ name: string; tools: string[]; error?: string }[]>("GET", "/api/mcp"),
  files: (path = "") => call<{ workspace: string; entries: { name: string; dir: boolean; path: string }[] }>("GET", `/api/files?path=${encodeURIComponent(path)}`),
  file: (path: string) => call<{ path: string; content: string }>("GET", `/api/file?path=${encodeURIComponent(path)}`),
  checkpoints: () => call<{ id: string; relPath: string; createdAt: number }[]>("GET", "/api/checkpoints"),
  runtime: () => call<{ gpu: string | false; model: string | null; loaded: boolean }>("GET", "/api/runtime"),
  projects: () => call<Project[]>("GET", "/api/projects"),
  createProject: (name: string, instructions = "", folder: string | null = null) => call<Project>("POST", "/api/projects", { name, instructions, folder }),
  updateProject: (id: string, patch: { name?: string; instructions?: string; folder?: string | null }) => call<Project>("PATCH", `/api/projects/${id}`, patch),
  deleteProject: (id: string) => call<{ ok: boolean }>("DELETE", `/api/projects/${id}`),
  projectFiles: (id: string) => call<{ id: string; name: string; size: number }[]>("GET", `/api/projects/${id}/files`),
  addProjectFile: (id: string, name: string, content: string) => call<{ ok: boolean }>("POST", `/api/projects/${id}/files`, { name, content }),
  deleteProjectFile: (fileId: string) => call<{ ok: boolean }>("DELETE", `/api/project-files/${fileId}`),
  branch: (conversationId: string, messageId: string) => call<Conversation>("POST", `/api/conversations/${conversationId}/branch`, { messageId }),
  truncate: (conversationId: string, messageId: string) => call<{ ok: boolean }>("POST", `/api/conversations/${conversationId}/truncate`, { messageId }),
  exportUrl: (conversationId: string, format: "md" | "json") => `/api/conversations/${conversationId}/export?format=${format}`,
  terminal: (command: string) => call<{ ok: boolean; output: string }>("POST", "/api/terminal", { command }),
};

export interface ChatRequest {
  conversationId: string;
  text: string;
  providerId: string;
  model: string;
  mode: Mode;
  toolFlags?: { web: boolean; mcp: boolean; skills: boolean; exec: boolean };
}

/** Envia uma mensagem e consome o fluxo de eventos (SSE). Use signal para interromper. */
export async function streamChat(req: ChatRequest, onEvent: (e: StreamEvent) => void, signal: AbortSignal): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Erro ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (line) onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
    }
  }
}
