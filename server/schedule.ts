// Tarefas agendadas: um pedido que roda sozinho em horário definido, numa conversa nova.
// Fica salvo no banco local (tabela kv) e é verificado a cada 30 segundos enquanto o app está aberto.
import { randomUUID } from "node:crypto";
import { runTurn } from "./agent.ts";
import { createConversation, getKv, setKv } from "./store.ts";
import type { Mode } from "./types.ts";

export type Repeat = "once" | "hourly" | "daily" | "weekly";

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  repeat: Repeat;
  /** Horário no formato HH:MM (usado em once, daily e weekly). */
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

const KEY = "schedules";
let running = false;

export function listTasks(): ScheduledTask[] {
  return getKv<ScheduledTask[]>(KEY, []);
}

function save(list: ScheduledTask[]): void {
  setKv(KEY, list);
}

/** Calcula a próxima execução a partir de agora. */
export function computeNext(repeat: Repeat, time: string, from = Date.now()): number {
  const [h, m] = (time || "09:00").split(":").map((x) => Number(x) || 0);
  if (repeat === "hourly") {
    const d = new Date(from);
    d.setMinutes(m, 0, 0);
    if (d.getTime() <= from) d.setHours(d.getHours() + 1);
    return d.getTime();
  }
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + (repeat === "weekly" ? 7 : 1));
  return d.getTime();
}

export function createTask(input: Partial<ScheduledTask> & { prompt: string }): ScheduledTask {
  const repeat = input.repeat ?? "daily";
  const time = input.time ?? "09:00";
  const task: ScheduledTask = {
    id: randomUUID().slice(0, 8),
    title: (input.title || input.prompt).slice(0, 60),
    prompt: input.prompt,
    repeat,
    time,
    enabled: input.enabled ?? true,
    mode: input.mode ?? "plan",
    folder: input.folder ?? null,
    nextRun: computeNext(repeat, time),
    lastRun: null,
    lastStatus: null,
    lastConversationId: null,
    createdAt: Date.now(),
  };
  save([...listTasks(), task]);
  return task;
}

export function updateTask(id: string, patch: Partial<ScheduledTask>): ScheduledTask | null {
  const list = listTasks();
  const t = list.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, patch, { id: t.id });
  if (patch.repeat !== undefined || patch.time !== undefined || patch.enabled) t.nextRun = computeNext(t.repeat, t.time);
  save(list);
  return t;
}

export function deleteTask(id: string): void {
  save(listTasks().filter((x) => x.id !== id));
}

/** Roda uma tarefa agora (botão "Executar agora" ou horário vencido). */
export async function runTask(id: string): Promise<void> {
  const t = listTasks().find((x) => x.id === id);
  if (!t) return;
  const conv = createConversation(`⏱ ${t.title}`, "chat", t.folder);
  updateTask(id, { lastStatus: "executando", lastRun: Date.now(), lastConversationId: conv.id });
  let failed = false;
  await runTurn({
    conversationId: conv.id,
    text: t.prompt,
    mode: t.mode,
    signal: new AbortController().signal,
    emit: (e) => {
      if (e.type === "error") failed = true;
    },
  });
  const after: Partial<ScheduledTask> = { lastStatus: failed ? "erro" : "ok" };
  if (t.repeat === "once") Object.assign(after, { enabled: false, nextRun: null });
  else after.nextRun = computeNext(t.repeat, t.time);
  const list = listTasks();
  const cur = list.find((x) => x.id === id);
  if (cur) {
    Object.assign(cur, after);
    save(list);
  }
}

async function tick(): Promise<void> {
  if (running) return;
  const due = listTasks().find((t) => t.enabled && t.nextRun !== null && t.nextRun <= Date.now());
  if (!due) return;
  running = true;
  try {
    await runTask(due.id);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  setInterval(() => void tick(), 30_000);
}
