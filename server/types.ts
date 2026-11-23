// Tipos compartilhados entre servidor e interface do Zenith Code 1.0.

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Formato neutro de mensagem; cada provedor converte para o seu formato. */
export interface ChatMessage {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ProviderKind = "native" | "openai" | "anthropic";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
}

export type Mode = "ask" | "accept_edits" | "plan" | "bypass";

export interface Settings {
  providers: ProviderConfig[];
  defaultProvider: string;
  defaultModel: string;
  workspace: string;
  mode: Mode;
  searxngUrl: string;
  alwaysAllow: string[];
  temperature: number;
  topP: number;
  responseStyle: "normal" | "conciso" | "detalhado" | "didatico";
  maxTokens: number;
  customPrompt: string;
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  projectId?: string | null;
  kind?: "chat" | "cowork" | "code";
  folder?: string | null;
  messageCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredMessage {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  createdAt: number;
}

/** Eventos enviados ao navegador por SSE durante um turno do agente. */
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; ok: boolean; output: string }
  | { type: "permission"; id: string; name: string; risk: "read" | "write" | "exec" | "network"; summary: string; args: Record<string, unknown> }
  | { type: "status"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
