// Hooks de ciclo de vida. Configurados em <workspace>/.zenith/hooks.json:
// { "PreToolUse": [{ "matcher": "run_command", "command": "node scripts/check.js" }], "PostToolUse": [...] }
// PreToolUse que sair com código 2 bloqueia a ferramenta; a saída do hook vira o motivo.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

interface HookEntry {
  matcher?: string;
  command: string;
}

export type HookEvent = "SessionStart" | "PreToolUse" | "PostToolUse" | "Stop";

type HooksFile = Partial<Record<HookEvent, HookEntry[]>>;

export interface HookResult {
  block: boolean;
  reason: string;
}

function readHooks(workspace: string): HooksFile {
  const file = path.join(workspace, ".zenith", "hooks.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as HooksFile;
  } catch {
    return {};
  }
}

export function listHooks(workspace: string): HooksFile {
  return readHooks(workspace);
}

export async function runHooks(
  event: HookEvent,
  toolName: string,
  args: Record<string, unknown>,
  workspace: string,
): Promise<HookResult> {
  const entries = (readHooks(workspace)[event] ?? []).filter((h) => !h.matcher || h.matcher === toolName || h.matcher === "*");
  for (const entry of entries) {
    const { code, output } = await execHook(entry.command, workspace, {
      ZENITH_EVENT: event,
      ZENITH_TOOL_NAME: toolName,
      ZENITH_TOOL_INPUT: JSON.stringify(args),
    });
    if (event === "PreToolUse" && code === 2) return { block: true, reason: output.trim() || "bloqueado por hook" };
    void output;
  }
  return { block: false, reason: "" };
}

function execHook(command: string, cwd: string, env: Record<string, string>): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, env: { ...process.env, ...env }, windowsHide: true });
    let out = "";
    const timer = setTimeout(() => child.kill(), 10_000);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: 1, output: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output: out });
    });
  });
}
