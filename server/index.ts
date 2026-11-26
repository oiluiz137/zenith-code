// Servidor do Zenith Code 1.0: API HTTP local (127.0.0.1), eventos em streaming (SSE) e interface estática.
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getKv, setKv,
  createConversation, deleteConversation, getConversation, getSettings, listConversations,
  listMessages, listCheckpoints, popCheckpoint, saveSettings, searchConversations, updateConversation,
  listProjects, createProject, getProject, updateProject, deleteProject, listProjectFiles, addProjectFile,
  deleteProjectFile, setConversationProject, truncateMessages, messageSeq, listArtifactMessages,
  listConversationCheckpoints, getCheckpoint, setCheckpointStatus, branchConversation,
} from "./store.ts";
import { lineDiff, toHunks, revertHunks } from "./diff.ts";
import { runTurn, memoryPath, memoryText, systemPrompt, jailbreakText } from "./agent.ts";
import { conversationFolder } from "./store.ts";
import { listModels } from "./providers.ts";
import { resolvePermission, type Decision } from "./permissions.ts";
import { resolveInside, runCommand } from "./tools.ts";
import fsSync from "node:fs";
import { listHooks } from "./hooks.ts";
import { runtimeInfo, countTokens, CONTEXT_SIZE } from "./native.ts";
import { ensureServers, mcpStatus } from "./mcp.ts";
import { pickFolder, gitStatus, gitDiff, startJob, listJobs, stopJob, contextCategories } from "./workspace.ts";
import { protectSecret, revealSecret, SECRETS_SUPPORTED } from "./secrets.ts";
import { startBatch, getBatch, listBatches } from "./batch.ts";
import { loadSkills, readSkillFile, writeProjectSkill, deleteProjectSkill } from "./skills.ts";
import { listTasks, createTask, updateTask, deleteTask, runTask, startScheduler } from "./schedule.ts";
import type { Mode, ProviderConfig, Settings } from "./types.ts";

const PORT = Number(process.env.ZENITH_PORT ?? 5178);
const HOST = "127.0.0.1";
import { APP_ROOT, MODELS_DIR } from "./paths.ts";
const DIST = path.join(APP_ROOT, "dist");
const VERSION: string = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8")).version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
})();
const MASK = "********";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function maskSettings(s: Settings) {
  return { ...s, providers: s.providers.map((p) => ({ ...p, apiKey: p.apiKey ? MASK : "" })) };
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<any> {
  // Junta os pedaços em bytes antes de decodificar: decodificar cada pedaço separado quebra acentos (UTF-8).
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const data = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? "GET";
  const p = url.pathname;

  if (method === "GET" && p === "/api/bootstrap") {
    const settings = getSettings();
    return send(res, 200, {
      name: "Zenith Code",
      version: VERSION,
      settings: maskSettings(settings),
      conversations: listConversations(),
      skills: loadSkills(settings.workspace).map((s) => ({ name: s.name, description: s.description })),
      hooks: listHooks(settings.workspace),
    });
  }

  if (method === "GET" && p === "/api/conversations") return send(res, 200, listConversations());

  if (method === "POST" && p === "/api/conversations") {
    const body = await readBody(req);
    const kind = ["chat", "cowork", "code"].includes(body.kind) ? body.kind : "chat";
    return send(res, 201, createConversation(body.title || "Nova conversa", kind, body.folder || null));
  }

  const convMatch = /^\/api\/conversations\/([^/]+)$/.exec(p);
  if (convMatch) {
    const id = convMatch[1];
    const conv = getConversation(id);
    if (!conv) return send(res, 404, { error: "Conversa não encontrada" });
    if (method === "GET") return send(res, 200, { conversation: conv, messages: listMessages(id) });
    if (method === "PATCH") {
      const body = await readBody(req);
      updateConversation(id, { title: body.title, pinned: body.pinned, folder: body.folder !== undefined ? body.folder || null : undefined });
      if (body.projectId !== undefined) setConversationProject(id, body.projectId || null);
      return send(res, 200, getConversation(id));
    }
    if (method === "DELETE") {
      deleteConversation(id);
      return send(res, 200, { ok: true });
    }
  }

  const branchMatch = /^\/api\/conversations\/([^/]+)\/branch$/.exec(p);
  if (branchMatch && method === "POST") {
    const body = await readBody(req);
    const branch = branchConversation(branchMatch[1], String(body.messageId ?? ""));
    return branch ? send(res, 201, branch) : send(res, 404, { error: "Mensagem não encontrada." });
  }

  const skillMatch = /^\/api\/skills\/([^/]+)$/.exec(p);
  if (skillMatch) {
    const name = decodeURIComponent(skillMatch[1]);
    const ws = getSettings().workspace;
    if (method === "GET") {
      const s = readSkillFile(ws, name);
      return s ? send(res, 200, s) : send(res, 404, { error: "Skill não encontrada." });
    }
    if (method === "PUT") {
      const body = await readBody(req);
      const err = writeProjectSkill(ws, name, String(body.content ?? ""));
      return err ? send(res, 400, { error: err }) : send(res, 200, { ok: true });
    }
    if (method === "DELETE") return send(res, deleteProjectSkill(ws, name) ? 200 : 404, { ok: true });
  }
  if (method === "GET" && p === "/api/artifacts") return send(res, 200, listArtifactMessages());

  if (method === "GET" && p === "/api/jailbreak") return send(res, 200, { text: jailbreakText() });

  // Pasta onde ficam os modelos .gguf (abre no Explorer quando pedido).
  if (p === "/api/models-dir") {
    if (method === "POST" && process.platform === "win32") spawn("explorer.exe", [MODELS_DIR], { detached: true, stdio: "ignore" }).unref();
    return send(res, 200, { path: MODELS_DIR });
  }

  if (p === "/api/skills-disabled") {
    if (method === "GET") return send(res, 200, getKv<string[]>("disabledSkills", []));
    if (method === "PUT") {
      const body = await readBody(req);
      const list = Array.isArray(body.names) ? body.names.map(String) : [];
      setKv("disabledSkills", list);
      return send(res, 200, list);
    }
  }

  if (method === "GET" && p === "/api/export-all") {
    const all = listConversations().map((c) => ({ ...c, messages: listMessages(c.id) }));
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="zenith-conversas-${new Date().toISOString().slice(0, 10)}.json"`,
    });
    res.end(JSON.stringify({ exportedAt: Date.now(), conversations: all }, null, 2));
    return;
  }

  if (p === "/api/schedules") {
    if (method === "GET") return send(res, 200, listTasks());
    if (method === "POST") {
      const body = await readBody(req);
      if (!body.prompt || !String(body.prompt).trim()) return send(res, 400, { error: "Escreva o pedido da tarefa." });
      return send(res, 200, createTask(body));
    }
  }
  const schedMatch = /^\/api\/schedules\/([^/]+)(\/run)?$/.exec(p);
  if (schedMatch) {
    const id = schedMatch[1];
    if (schedMatch[2] && method === "POST") {
      void runTask(id);
      return send(res, 200, { ok: true });
    }
    if (method === "PATCH") return send(res, 200, updateTask(id, await readBody(req)));
    if (method === "DELETE") {
      deleteTask(id);
      return send(res, 200, { ok: true });
    }
  }

  if (method === "GET" && p === "/api/search") {
    return send(res, 200, searchConversations(url.searchParams.get("q") ?? ""));
  }

  if (method === "GET" && p === "/api/settings") return send(res, 200, maskSettings(getSettings()));

  if (method === "PUT" && p === "/api/settings") {
    const body = (await readBody(req)) as Partial<Settings>;
    const current = getSettings();
    const next: Settings = { ...current, ...body, providers: current.providers };
    if (body.providers) {
      // Mescla por id: provedores enviados substituem os atuais; os demais são mantidos.
      const merged = new Map(current.providers.map((p) => [p.id, p] as const));
      for (const incoming of body.providers as ProviderConfig[]) {
        const old = merged.get(incoming.id);
        const apiKey = incoming.apiKey === MASK ? old?.apiKey : protectSecret(incoming.apiKey ?? "");
        merged.set(incoming.id, { ...old, ...incoming, apiKey });
      }
      next.providers = [...merged.values()];
    }
    if (body.mode && !["ask", "accept_edits", "plan", "bypass"].includes(body.mode)) return send(res, 400, { error: "Modo inválido" });
    saveSettings(next);
    return send(res, 200, maskSettings(getSettings()));
  }

  if (method === "GET" && p === "/api/models") {
    const settings = getSettings();
    const provider = settings.providers.find((x) => x.id === url.searchParams.get("provider"));
    if (!provider) return send(res, 404, { error: "Provedor não encontrado" });
    try {
      return send(res, 200, { models: await listModels({ ...provider, apiKey: revealSecret(provider.apiKey ?? "") }) });
    } catch (err) {
      return send(res, 502, { error: (err as Error).message, models: [] });
    }
  }

  if (method === "POST" && p === "/api/chat") {
    const body = await readBody(req);
    if (!getConversation(body.conversationId)) return send(res, 404, { error: "Conversa não encontrada" });
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    await runTurn({
      conversationId: body.conversationId,
      text: String(body.text ?? ""),
      providerId: body.providerId,
      model: body.model,
      mode: body.mode as Mode | undefined,
      toolFlags: body.toolFlags,
      signal: controller.signal,
      emit: (event) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    });
    res.end();
    return;
  }

  const permMatch = /^\/api\/permissions\/([^/]+)$/.exec(p);
  if (method === "POST" && permMatch) {
    const body = await readBody(req);
    const decision = (body.decision ?? "deny") as Decision;
    const ok = resolvePermission(permMatch[1], decision);
    return send(res, ok ? 200 : 404, { ok });
  }

  // Projetos
  if (method === "GET" && p === "/api/projects") return send(res, 200, listProjects());
  if (method === "POST" && p === "/api/projects") {
    const body = await readBody(req);
    if (body.folder && !fsSync.existsSync(String(body.folder))) return send(res, 400, { error: `A pasta não existe: ${body.folder}` });
    return send(res, 201, createProject(String(body.name || "Novo projeto"), String(body.instructions ?? ""), body.folder || null));
  }
  const projMatch = /^\/api\/projects\/([^/]+)$/.exec(p);
  if (projMatch) {
    const id = projMatch[1];
    if (!getProject(id)) return send(res, 404, { error: "Projeto não encontrado" });
    if (method === "PATCH") {
      const body = await readBody(req);
      if (body.folder && !fsSync.existsSync(String(body.folder))) return send(res, 400, { error: `A pasta não existe: ${body.folder}` });
      updateProject(id, { name: body.name, instructions: body.instructions, folder: body.folder !== undefined ? body.folder || null : undefined });
      return send(res, 200, getProject(id));
    }
    if (method === "DELETE") {
      deleteProject(id);
      return send(res, 200, { ok: true });
    }
  }
  const projFilesMatch = /^\/api\/projects\/([^/]+)\/files$/.exec(p);
  if (projFilesMatch && method === "GET") {
    return send(res, 200, listProjectFiles(projFilesMatch[1]).map(({ content: _c, ...f }) => f));
  }
  if (projFilesMatch && method === "POST") {
    const body = await readBody(req);
    const text = String(body.content ?? "");
    if (text.length > 2_000_000) return send(res, 413, { error: "Arquivo grande demais (limite de 2 MB de texto)." });
    addProjectFile(projFilesMatch[1], String(body.name ?? "arquivo.txt"), text);
    return send(res, 201, { ok: true });
  }
  const projFileDel = /^\/api\/project-files\/([^/]+)$/.exec(p);
  if (projFileDel && method === "DELETE") {
    deleteProjectFile(projFileDel[1]);
    return send(res, 200, { ok: true });
  }

  // Exportação e edição com reenvio
  const exportMatch = /^\/api\/conversations\/([^/]+)\/export$/.exec(p);
  if (exportMatch && method === "GET") {
    const conv = getConversation(exportMatch[1]);
    if (!conv) return send(res, 404, { error: "Conversa não encontrada" });
    const msgs = listMessages(conv.id).filter((m) => m.role === "user" || m.role === "assistant");
    const format = url.searchParams.get("format") === "json" ? "json" : "md";
    const safeName = conv.title.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "conversa";
    if (format === "json") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${safeName}.json"` });
      res.end(JSON.stringify({ title: conv.title, messages: msgs }, null, 2));
      return;
    }
    const md = `# ${conv.title}\n\n` + msgs.map((m) => `## ${m.role === "user" ? "Você" : "Zenith"}\n\n${m.content}\n`).join("\n");
    res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${safeName}.md"` });
    res.end(md);
    return;
  }
  const truncMatch = /^\/api\/conversations\/([^/]+)\/truncate$/.exec(p);
  if (truncMatch && method === "POST") {
    const body = await readBody(req);
    const seq = messageSeq(String(body.messageId ?? ""));
    if (seq === undefined) return send(res, 404, { error: "Mensagem não encontrada" });
    truncateMessages(truncMatch[1], seq);
    return send(res, 200, { ok: true });
  }

  if (method === "GET" && p === "/api/runtime") return send(res, 200, await runtimeInfo());

  if (method === "POST" && p === "/api/pick-folder") return send(res, 200, await pickFolder());

  // Feedback local: polegar para cima/baixo nas respostas, guardado só neste computador.
  if (p === "/api/feedback") {
    if (method === "GET") return send(res, 200, getKv<Record<string, string>>("feedback", {}));
    if (method === "POST") {
      const body = await readBody(req);
      const map = getKv<Record<string, string>>("feedback", {});
      if (body.value === "up" || body.value === "down") map[String(body.messageId)] = body.value;
      else delete map[String(body.messageId)];
      setKv("feedback", map);
      return send(res, 200, map);
    }
  }

  if (method === "POST" && p === "/api/batch") {
    const body = await readBody(req);
    const prompts = (Array.isArray(body.prompts) ? body.prompts : []).map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 50);
    if (prompts.length === 0) return send(res, 400, { error: "Envie ao menos um pedido em prompts." });
    const mode = ["ask", "accept_edits", "plan", "bypass"].includes(body.mode) ? body.mode : "plan";
    return send(res, 202, startBatch(prompts, { providerId: body.providerId, model: body.model, mode, folder: body.folder || null }));
  }
  if (method === "GET" && p === "/api/batch") return send(res, 200, listBatches());
  const batchMatch = /^\/api\/batch\/([^/]+)$/.exec(p);
  if (batchMatch && method === "GET") {
    const b = getBatch(batchMatch[1]);
    return b ? send(res, 200, b) : send(res, 404, { error: "Lote não encontrado" });
  }

  if (method === "GET" && p === "/api/git/diff") {
    const conv = url.searchParams.get("conversationId");
    const folder = (conv ? conversationFolder(conv) : null) ?? getSettings().workspace;
    const file = url.searchParams.get("path") ?? "";
    if (!file) return send(res, 400, { error: "Informe o arquivo." });
    try {
      resolveInside(folder, file);
    } catch (err) {
      return send(res, 400, { error: (err as Error).message });
    }
    return send(res, 200, await gitDiff(folder, file));
  }

  if (method === "GET" && p === "/api/git/status") {
    const conv = url.searchParams.get("conversationId");
    const folder = (conv ? conversationFolder(conv) : null) ?? getSettings().workspace;
    return send(res, 200, { folder, ...(await gitStatus(folder)) });
  }

  if (method === "GET" && p === "/api/context") {
    const conv = url.searchParams.get("conversationId") ?? "";
    const settings = getSettings();
    const skills = loadSkills(settings.workspace);
    const msgs = conv ? listMessages(conv) : [];
    return send(res, 200, contextCategories(msgs, systemPrompt(settings, settings.mode, skills), countTokens, CONTEXT_SIZE));
  }

  if (method === "GET" && p === "/api/jobs") return send(res, 200, listJobs());
  if (method === "POST" && p === "/api/jobs") {
    const body = await readBody(req);
    const cwd = (body.conversationId ? conversationFolder(body.conversationId) : null) ?? getSettings().workspace;
    return send(res, 201, startJob(String(body.command ?? ""), cwd));
  }
  const jobStop = /^\/api\/jobs\/([^/]+)\/stop$/.exec(p);
  if (jobStop && method === "POST") return send(res, 200, { ok: stopJob(jobStop[1]) });

  if (method === "GET" && p === "/api/mcp") {
    await ensureServers(getSettings().workspace);
    return send(res, 200, mcpStatus());
  }

  if (method === "GET" && p === "/api/file") {
    const ws = getSettings().workspace;
    try {
      const file = resolveInside(ws, url.searchParams.get("path") ?? "");
      const stat = fsSync.statSync(file);
      if (stat.isDirectory() || stat.size > 300_000) return send(res, 400, { error: "Arquivo grande ou pasta." });
      return send(res, 200, { path: url.searchParams.get("path"), content: fsSync.readFileSync(file, "utf8") });
    } catch (err) {
      return send(res, 400, { error: (err as Error).message });
    }
  }

  if (method === "GET" && p === "/api/files") {
    const ws = getSettings().workspace;
    try {
      const dir = resolveInside(ws, url.searchParams.get("path") ?? "");
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
        .map((e) => ({ name: e.name, dir: e.isDirectory(), path: path.relative(ws, path.join(dir, e.name)) }))
        .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
      return send(res, 200, { workspace: ws, entries });
    } catch (err) {
      return send(res, 400, { error: (err as Error).message });
    }
  }

  if (p === "/api/memory") {
    const ws = getSettings().workspace;
    const file = memoryPath(ws);
    if (method === "GET") return send(res, 200, { content: memoryText(ws) });
    if (method === "PUT") {
      const body = await readBody(req);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, String(body.content ?? "").slice(0, 20000), "utf8");
      return send(res, 200, { ok: true });
    }
  }

  if (method === "GET" && p === "/api/checkpoints") return send(res, 200, listCheckpoints());

  // Edições do agente nesta conversa, com os trechos alterados, para revisar, aceitar ou reverter.
  if (method === "GET" && p === "/api/edits") {
    const conv = url.searchParams.get("conversationId") ?? "";
    const fallback = getSettings().workspace;
    const list = listConversationCheckpoints(conv).map((cp) => {
      const abs = resolveInside(cp.base ?? fallback, cp.relPath);
      const current = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
      const reviewable = cp.after !== null;
      const hunks = reviewable && (cp.previous ?? "").length + (cp.after ?? "").length < 400_000 ? toHunks(lineDiff(cp.previous ?? "", cp.after ?? "")) : [];
      const added = hunks.reduce((n, h) => n + h.lines.filter((l) => l.startsWith("+")).length, 0);
      const removed = hunks.reduce((n, h) => n + h.lines.filter((l) => l.startsWith("-")).length, 0);
      return {
        id: cp.id,
        relPath: cp.relPath,
        toolCallId: cp.toolCallId,
        status: cp.status,
        existed: cp.existed,
        createdAt: cp.createdAt,
        reviewable,
        stale: reviewable && current !== cp.after,
        added,
        removed,
        hunks,
      };
    });
    return send(res, 200, list);
  }

  const editMatch = /^\/api\/edits\/([^/]+)\/(revert|accept)$/.exec(p);
  if (editMatch && method === "POST") {
    const cp = getCheckpoint(editMatch[1]);
    if (!cp) return send(res, 404, { error: "Edição não encontrada." });
    if (editMatch[2] === "accept") {
      setCheckpointStatus(cp.id, "accepted");
      return send(res, 200, { ok: true, message: `Alteração mantida: ${cp.relPath}` });
    }
    if (cp.after === null) return send(res, 409, { error: "Esta edição é anterior à revisão por trecho. Use Desfazer." });
    const abs = resolveInside(cp.base ?? getSettings().workspace, cp.relPath);
    const current = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
    if (current !== cp.after) return send(res, 409, { error: `${cp.relPath} mudou depois desta edição. Reverta as edições mais novas primeiro.` });
    const body = await readBody(req);
    const chosen: number[] | undefined = Array.isArray(body.hunks) ? body.hunks.map(Number) : undefined;
    const total = toHunks(lineDiff(cp.previous ?? "", cp.after)).length;
    if (!chosen || chosen.length >= total) {
      if (cp.existed) fs.writeFileSync(abs, cp.previous ?? "", "utf8");
      else if (fs.existsSync(abs)) fs.unlinkSync(abs);
      setCheckpointStatus(cp.id, "reverted");
      return send(res, 200, { ok: true, message: `Revertido: ${cp.relPath}${cp.existed ? "" : " (arquivo removido)"}` });
    }
    const next = revertHunks(cp.previous ?? "", cp.after, chosen);
    fs.writeFileSync(abs, next, "utf8");
    // O "depois" passa a ser o texto parcial; o "antes" continua o original, então dá para reverter o resto depois.
    setCheckpointStatus(cp.id, "partial", next);
    return send(res, 200, { ok: true, message: `${chosen.length} trecho(s) revertido(s) em ${cp.relPath}` });
  }

  if (method === "POST" && p === "/api/checkpoints/undo") {
    const cp = popCheckpoint();
    if (!cp) return send(res, 404, { ok: false, message: "Nada para desfazer." });
    const settings = getSettings();
    const abs = resolveInside(cp.base ?? settings.workspace, cp.relPath);
    if (cp.existed) fs.writeFileSync(abs, cp.previous ?? "", "utf8");
    else if (fs.existsSync(abs)) fs.unlinkSync(abs);
    return send(res, 200, { ok: true, message: `Desfeito: ${cp.relPath}${cp.existed ? "" : " (arquivo removido)"}` });
  }

  if (method === "POST" && p === "/api/terminal") {
    const body = await readBody(req);
    const settings = getSettings();
    const result = await runCommand(String(body.command ?? ""), settings.workspace, 120_000);
    return send(res, 200, result);
  }

  return send(res, 404, { error: "Rota não encontrada" });
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>Zenith Code 1.0</h1><p>A interface ainda não foi compilada. Rode <code>npm run build</code> ou use <code>npm run dev</code>.</p>");
    return;
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
  void req;
}

// No app de desktop, o Electron passa uma senha por sessão (ZENITH_TOKEN) e a envia em todo pedido
// da janela. Outros programas do computador não conseguem usar o servidor sem ela.
const TOKEN = process.env.ZENITH_TOKEN ?? "";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  // Só aceita pedidos endereçados a este computador (evita ataques de DNS rebinding).
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (host !== "127.0.0.1" && host !== "localhost") {
    res.writeHead(403).end("Host não permitido");
    return;
  }
  if (TOKEN && req.headers["x-zenith-token"] !== TOKEN) {
    res.writeHead(403).end("Acesso negado");
    return;
  }
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) send(res, 500, { error: (err as Error).message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  startScheduler();
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : PORT;
  console.log(`Zenith Code 1.0 em http://${HOST}:${port}`);
  // Rodando dentro do app de desktop (utilityProcess do Electron): avisa a janela que está pronto.
  const parentPort = (process as unknown as { parentPort?: { postMessage: (m: unknown) => void } }).parentPort;
  parentPort?.postMessage({ type: "ready", port });
});

server.on("error", (err) => {
  console.error(`Falha ao iniciar o servidor: ${err.message}`);
  process.exit(1);
});
