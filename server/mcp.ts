// Cliente MCP (Model Context Protocol) via stdio.
// Configuração em <workspace>/.zenith/mcp.json:
// { "servers": { "arquivos": { "command": "node", "args": ["servidor.js"] } } }
// Cada ferramenta vira "mcp__<servidor>__<ferramenta>" e sempre pede permissão (risco de execução).
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ToolSpec } from "./types.ts";

interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface Connection {
  name: string;
  proc: ChildProcessWithoutNullStreams;
  pending: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>;
  nextId: number;
  tools: ToolSpec[];
  error?: string;
}

const connections = new Map<string, Connection>();
let loadedFor = "";

function readConfig(workspace: string): Record<string, ServerConfig> {
  const file = path.join(workspace, ".zenith", "mcp.json");
  if (!fs.existsSync(file)) return {};
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")).servers ?? {}) as Record<string, ServerConfig>;
  } catch {
    return {};
  }
}

function request(conn: Connection, method: string, params: unknown, timeoutMs = 15000): Promise<any> {
  const id = conn.nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.pending.delete(id);
      reject(new Error(`${conn.name}: tempo esgotado em ${method}`));
    }, timeoutMs);
    conn.pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    conn.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function start(name: string, cfg: ServerConfig): Promise<Connection> {
  const proc = spawn(cfg.command, cfg.args ?? [], { env: { ...process.env, ...(cfg.env ?? {}) }, shell: process.platform === "win32", windowsHide: true });
  const conn: Connection = { name, proc, pending: new Map(), nextId: 1, tools: [] };
  let buffer = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined && conn.pending.has(msg.id)) {
        const p = conn.pending.get(msg.id)!;
        conn.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message ?? "erro MCP"));
        else p.resolve(msg.result);
      }
    }
  });
  proc.on("error", (err) => {
    conn.error = err.message;
  });
  proc.on("exit", () => {
    conn.error ??= "servidor encerrou";
  });
  await request(conn, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "zenith-code", version: "1.0.0" },
  });
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const listed = await request(conn, "tools/list", {});
  conn.tools = (listed.tools ?? []).map((t: any) => ({
    name: `mcp__${name}__${t.name}`,
    description: `[MCP ${name}] ${t.description ?? t.name}`,
    parameters: t.inputSchema ?? { type: "object", properties: {} },
  }));
  return conn;
}

/** Conecta aos servidores configurados (uma vez por pasta de trabalho). */
export async function ensureServers(workspace: string): Promise<void> {
  if (loadedFor === workspace) return;
  for (const c of connections.values()) c.proc.kill();
  connections.clear();
  for (const [name, cfg] of Object.entries(readConfig(workspace))) {
    try {
      connections.set(name, await start(name, cfg));
    } catch (err) {
      connections.set(name, { name, proc: null as any, pending: new Map(), nextId: 1, tools: [], error: (err as Error).message });
    }
  }
  loadedFor = workspace;
}

export function mcpTools(): ToolSpec[] {
  return [...connections.values()].flatMap((c) => c.tools);
}

export function mcpStatus(): { name: string; tools: string[]; error?: string }[] {
  return [...connections.values()].map((c) => ({ name: c.name, tools: c.tools.map((t) => t.name), error: c.error }));
}

/** Executa uma ferramenta MCP no formato mcp__<servidor>__<ferramenta>. */
export async function callMcpTool(fullName: string, args: Record<string, unknown>): Promise<{ ok: boolean; output: string }> {
  const [, server, ...rest] = fullName.split("__");
  const tool = rest.join("__");
  const conn = connections.get(server);
  if (!conn || conn.error || !conn.proc) return { ok: false, output: `Servidor MCP indisponível: ${server}` };
  try {
    const result = await request(conn, "tools/call", { name: tool, arguments: args });
    const text = (result.content ?? []).map((c: any) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n");
    return { ok: !result.isError, output: text.slice(0, 12000) || "(sem saída)" };
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

export function stopServers(): void {
  for (const c of connections.values()) c.proc?.kill();
  connections.clear();
  loadedFor = "";
}
