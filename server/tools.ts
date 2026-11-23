// Ferramentas do agente. Todas as operações de arquivo são limitadas à pasta de trabalho (workspace).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ToolSpec, Settings } from "./types.ts";

export type Risk = "read" | "write" | "exec" | "network";

export interface ToolDef extends ToolSpec {
  risk: Risk;
}

export const TOOLS: ToolDef[] = [
  {
    name: "list_dir",
    description: "List files and folders inside the workspace. Path is relative to the workspace root.",
    risk: "read",
    parameters: { type: "object", properties: { path: { type: "string", description: "Relative folder path. Empty means root." } } },
  },
  {
    name: "read_file",
    description: "Read a text file inside the workspace.",
    risk: "read",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "search_text",
    description: "Search for a text string in workspace files. Returns matching lines with file and line number.",
    risk: "read",
    parameters: { type: "object", properties: { query: { type: "string" }, path: { type: "string" } }, required: ["query"] },
  },
  {
    name: "write_file",
    description: "Create or overwrite a text file inside the workspace. Creates parent folders.",
    risk: "write",
    parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
  },
  {
    name: "edit_file",
    description: "Replace one exact occurrence of old_string with new_string in a file. old_string must be unique.",
    risk: "write",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the workspace (PowerShell on Windows). Returns exit code and output.",
    risk: "exec",
    parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
  {
    name: "web_search",
    description: "Search the web and return a list of results with title, URL and snippet.",
    risk: "network",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "web_fetch",
    description: "Fetch a web page and return its readable text.",
    risk: "network",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

export const MAX_OUTPUT = 12000;

export function resolveInside(workspace: string, rel: string): string {
  const root = path.resolve(workspace);
  const target = path.resolve(root, rel || ".");
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Caminho fora da pasta de trabalho: ${rel}`);
  }
  return target;
}

function clip(text: string): string {
  return text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + `\n… (saída cortada em ${MAX_OUTPUT} caracteres)` : text;
}

/** Texto curto que descreve a ação, usado no cartão de permissão. */
export function describeAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "run_command":
      return `Executar: ${String(args.command ?? "")}`;
    case "write_file":
      return `Gravar arquivo: ${String(args.path ?? "")} (${String(args.content ?? "").length} caracteres)`;
    case "edit_file":
      return `Editar arquivo: ${String(args.path ?? "")}`;
    case "web_fetch":
      return `Acessar página: ${String(args.url ?? "")}`;
    case "web_search":
      return `Pesquisar na web: ${String(args.query ?? "")}`;
    default:
      return `${name} ${JSON.stringify(args)}`;
  }
}

/** Chave usada em "sempre permitir". Comandos são agrupados pelo primeiro termo. */
export function permissionKey(name: string, args: Record<string, unknown>): string {
  if (name === "run_command") {
    const first = String(args.command ?? "").trim().split(/\s+/)[0] ?? "";
    return `run_command:${first.toLowerCase()}`;
  }
  return name;
}

export async function executeTool(name: string, args: Record<string, unknown>, settings: Settings): Promise<{ ok: boolean; output: string }> {
  const ws = settings.workspace;
  try {
    switch (name) {
      case "list_dir": {
        const dir = resolveInside(ws, String(args.path ?? ""));
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const lines = entries
          .filter((e) => e.name !== "node_modules" && e.name !== ".git")
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort();
        return { ok: true, output: lines.join("\n") || "(pasta vazia)" };
      }
      case "read_file": {
        const file = resolveInside(ws, String(args.path ?? ""));
        return { ok: true, output: clip(fs.readFileSync(file, "utf8")) };
      }
      case "search_text": {
        const base = resolveInside(ws, String(args.path ?? ""));
        const query = String(args.query ?? "");
        const hits: string[] = [];
        walk(base, (file) => {
          if (hits.length >= 60) return;
          let text: string;
          try {
            text = fs.readFileSync(file, "utf8");
          } catch {
            return;
          }
          text.split(/\r?\n/).forEach((line, i) => {
            if (line.includes(query) && hits.length < 60) hits.push(`${path.relative(ws, file)}:${i + 1}: ${line.trim().slice(0, 200)}`);
          });
        });
        return { ok: true, output: hits.join("\n") || "Nenhuma ocorrência." };
      }
      case "write_file": {
        const file = resolveInside(ws, String(args.path ?? ""));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, String(args.content ?? ""), "utf8");
        return { ok: true, output: `Arquivo gravado: ${path.relative(ws, file)}` };
      }
      case "edit_file": {
        const file = resolveInside(ws, String(args.path ?? ""));
        const text = fs.readFileSync(file, "utf8");
        const oldS = String(args.old_string ?? "");
        const count = oldS ? text.split(oldS).length - 1 : 0;
        if (count !== 1) return { ok: false, output: `old_string precisa aparecer exatamente uma vez (encontrado ${count}).` };
        fs.writeFileSync(file, text.replace(oldS, () => String(args.new_string ?? "")), "utf8");
        return { ok: true, output: `Arquivo editado: ${path.relative(ws, file)}` };
      }
      case "run_command":
        return await runCommand(String(args.command ?? ""), ws, 120_000);
      case "web_search":
        return await webSearch(String(args.query ?? ""), settings.searxngUrl);
      case "web_fetch":
        return await webFetch(String(args.url ?? ""));
      default:
        return { ok: false, output: `Ferramenta desconhecida: ${name}` };
    }
  } catch (err) {
    return { ok: false, output: (err as Error).message };
  }
}

function walk(dir: string, visit: (file: string) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, visit);
    else if (e.isFile() && fs.statSync(full).size < 512_000) visit(full);
  }
}

/** Executa um comando no workspace. Também usado pelo terminal da interface (ação do próprio usuário). */
export function runCommand(command: string, cwd: string, timeoutMs: number): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const child = isWin
      ? spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { cwd, windowsHide: true })
      : spawn("/bin/sh", ["-c", command], { cwd });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      out += `\n[tempo limite de ${timeoutMs / 1000}s atingido]`;
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, output: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: clip(`${out}\n[código de saída ${code}]`.trim()) });
    });
  });
}

async function webSearch(query: string, searxngUrl: string): Promise<{ ok: boolean; output: string }> {
  if (!query.trim()) return { ok: false, output: "Consulta vazia." };
  if (searxngUrl) {
    const res = await fetch(`${searxngUrl.replace(/\/+$/, "")}/search?format=json&q=${encodeURIComponent(query)}`);
    if (!res.ok) return { ok: false, output: `SearXNG respondeu ${res.status}` };
    const json: any = await res.json();
    const items = (json.results ?? []).slice(0, 8).map((r: any, i: number) => `${i + 1}. ${r.title}\n${r.url}\n${r.content ?? ""}`);
    return { ok: true, output: items.join("\n\n") || "Sem resultados." };
  }
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": "ZenithCode/1.0" },
  });
  if (!res.ok) return { ok: false, output: `Busca respondeu ${res.status}` };
  const html = await res.text();
  const results: string[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && results.length < 8) {
    results.push(`${results.length + 1}. ${stripTags(m[2])}\n${decodeUrl(m[1])}\n${stripTags(m[3])}`);
  }
  return { ok: true, output: results.join("\n\n") || "Sem resultados (a busca padrão pode estar bloqueada; configure um SearXNG nas configurações)." };
}

async function webFetch(url: string): Promise<{ ok: boolean; output: string }> {
  if (!/^https?:\/\//.test(url)) return { ok: false, output: "URL inválida." };
  const res = await fetch(url, { headers: { "user-agent": "ZenithCode/1.0" } });
  if (!res.ok) return { ok: false, output: `Página respondeu ${res.status}` };
  const text = stripTags(await res.text());
  return { ok: true, output: clip(text) };
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeUrl(href: string): string {
  const m = /uddg=([^&]+)/.exec(href);
  return m ? decodeURIComponent(m[1]) : href;
}
