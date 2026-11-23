// Funções de ambiente da pasta de trabalho: escolher pasta, git, tarefas em segundo plano.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

/** Abre o seletor de pastas do Windows e devolve o caminho escolhido (ou null se cancelado). */
export function pickFolder(): Promise<{ path: string | null; error?: string }> {
  if (process.platform !== "win32") {
    return Promise.resolve({ path: null, error: "Seletor de pastas nativo disponível só no Windows nesta versão. Digite o caminho." });
  }
  // A janela "dona" invisível e sempre no topo faz o seletor abrir na frente do navegador,
  // em vez de ficar escondido atrás dele (o processo do servidor não tem janela própria).
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.Opacity = 0; $owner.StartPosition = 'CenterScreen'",
    "$owner.Show(); $owner.Activate()",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$d.Description = 'Escolha a pasta de trabalho'",
    "$d.ShowNewFolderButton = $true",
    "$r = $d.ShowDialog($owner)",
    "$owner.Close()",
    "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $d.SelectedPath }",
  ].join("; ");
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: false, timeout: 300_000 }, (err, stdout) => {
      if (err) return resolve({ path: null, error: err.message });
      const chosen = stdout.trim();
      resolve({ path: chosen ? chosen : null });
    });
  });
}

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  files: { status: string; path: string }[];
  error?: string;
}

/** Estado do git da pasta: ramo e arquivos alterados. Pasta sem git retorna isRepo=false. */
export function gitStatus(folder: string): Promise<GitStatus> {
  if (!fs.existsSync(folder)) return Promise.resolve({ isRepo: false, files: [], error: "Pasta não existe." });
  return new Promise((resolve) => {
    execFile("git", ["-C", folder, "rev-parse", "--is-inside-work-tree"], { timeout: 10_000 }, (err) => {
      if (err) return resolve({ isRepo: false, files: [] });
      execFile("git", ["-C", folder, "status", "--porcelain=v1", "-b"], { timeout: 15_000, maxBuffer: 2_000_000 }, (e2, out) => {
        if (e2) return resolve({ isRepo: true, files: [], error: e2.message });
        const lines = out.split(/\r?\n/).filter(Boolean);
        let branch: string | undefined;
        const files: { status: string; path: string }[] = [];
        for (const line of lines) {
          if (line.startsWith("## ")) branch = line.slice(3).split("...")[0];
          else files.push({ status: line.slice(0, 2).trim() || "?", path: line.slice(3) });
        }
        resolve({ isRepo: true, branch, files });
      });
    });
  });
}

/** Diferença de um arquivo em relação ao último commit (texto limitado). */
export function gitDiff(folder: string, file: string): Promise<{ ok: boolean; diff: string }> {
  return new Promise((resolve) => {
    execFile("git", ["-C", folder, "diff", "HEAD", "--", file], { timeout: 15_000, maxBuffer: 2_000_000 }, (err, out, stderr) => {
      if (err) return resolve({ ok: false, diff: stderr || err.message });
      const text = out.trim() ? out : "Sem diferença em relação ao último commit (arquivo novo ou sem alterações).";
      resolve({ ok: true, diff: text.length > 20000 ? text.slice(0, 20000) + "\n… (cortado)" : text });
    });
  });
}

// ---------- Tarefas em segundo plano ----------

export interface Job {
  id: string;
  command: string;
  cwd: string;
  status: "rodando" | "concluída" | "erro" | "parada";
  startedAt: number;
  output: string;
  code?: number | null;
}

const jobs = new Map<string, { info: Job; proc: ChildProcess }>();

export function startJob(command: string, cwd: string): Job {
  const id = randomUUID().slice(0, 8);
  const isWin = process.platform === "win32";
  const proc = isWin
    ? spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { cwd, windowsHide: true })
    : spawn("/bin/sh", ["-c", command], { cwd });
  const info: Job = { id, command, cwd, status: "rodando", startedAt: Date.now(), output: "" };
  const append = (d: Buffer) => {
    info.output = (info.output + d.toString()).slice(-8000);
  };
  proc.stdout?.on("data", append);
  proc.stderr?.on("data", append);
  proc.on("error", (err) => {
    info.status = "erro";
    info.output += `\n${err.message}`;
  });
  proc.on("close", (code) => {
    info.code = code;
    if (info.status === "rodando") info.status = code === 0 ? "concluída" : "erro";
  });
  jobs.set(id, { info, proc });
  return info;
}

export function listJobs(): Job[] {
  return [...jobs.values()].map((j) => j.info).sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);
}

export function stopJob(id: string): boolean {
  const j = jobs.get(id);
  if (!j) return false;
  if (j.info.status === "rodando") {
    j.info.status = "parada";
    j.proc.kill();
  }
  return true;
}

// ---------- Contexto ----------

export interface ContextCategory {
  label: string;
  tokens: number;
}

/** Estimativa de uso do contexto por categoria (caracteres / 4). */
export function contextCategories(messages: { role: string; content: string }[], systemText: string): { limit: number; used: number; categories: ContextCategory[] } {
  const limit = 8192;
  const est = (s: string) => Math.ceil(s.length / 4);
  const userAssistant = messages.filter((m) => m.role === "user" || m.role === "assistant").reduce((n, m) => n + est(m.content), 0);
  const tools = messages.filter((m) => m.role === "tool").reduce((n, m) => n + est(m.content), 0);
  const system = est(systemText);
  const used = userAssistant + tools + system;
  return {
    limit,
    used,
    categories: [
      { label: "Mensagens", tokens: userAssistant },
      { label: "Resultados de ferramentas", tokens: tools },
      { label: "Instruções e skills", tokens: system },
      { label: "Espaço livre", tokens: Math.max(0, limit - used) },
    ],
  };
}
