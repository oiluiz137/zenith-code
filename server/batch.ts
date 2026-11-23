// Lote: executa uma lista de pedidos em sequência, em segundo plano, com nova tentativa em caso de falha.
// O modelo local atende uma geração por vez, então o lote roda um pedido de cada vez.
import { randomUUID } from "node:crypto";
import { runTurn } from "./agent.ts";
import { createConversation, listMessages } from "./store.ts";
import type { Mode } from "./types.ts";

export interface BatchItem {
  prompt: string;
  status: "pendente" | "executando" | "concluído" | "erro";
  conversationId?: string;
  answer?: string;
  error?: string;
  attempts: number;
}

export interface Batch {
  id: string;
  createdAt: number;
  status: "executando" | "concluído";
  providerId?: string;
  model?: string;
  mode: Mode;
  items: BatchItem[];
}

const batches = new Map<string, Batch>();
const MAX_ATTEMPTS = 2;

export function startBatch(prompts: string[], opts: { providerId?: string; model?: string; mode?: Mode; folder?: string | null }): Batch {
  const batch: Batch = {
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    status: "executando",
    providerId: opts.providerId,
    model: opts.model,
    mode: opts.mode ?? "plan",
    items: prompts.map((prompt) => ({ prompt, status: "pendente", attempts: 0 })),
  };
  batches.set(batch.id, batch);
  void runBatch(batch, opts.folder ?? null);
  return batch;
}

async function runBatch(batch: Batch, folder: string | null): Promise<void> {
  for (const item of batch.items) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      item.attempts = attempt;
      item.status = "executando";
      const conv = createConversation(item.prompt.slice(0, 60) || "Lote", "chat", folder);
      item.conversationId = conv.id;
      let text = "";
      let failure = "";
      await runTurn({
        conversationId: conv.id,
        text: item.prompt,
        providerId: batch.providerId,
        model: batch.model,
        mode: batch.mode,
        signal: new AbortController().signal,
        emit: (e) => {
          if (e.type === "delta") text += e.text;
          if (e.type === "error") failure = e.message;
        },
      });
      if (!failure) {
        item.status = "concluído";
        item.answer = text || listMessages(conv.id).filter((m) => m.role === "assistant").pop()?.content || "";
        break;
      }
      item.error = failure;
      if (attempt === MAX_ATTEMPTS) item.status = "erro";
    }
  }
  batch.status = "concluído";
}

export function getBatch(id: string): Batch | undefined {
  return batches.get(id);
}

export function listBatches(): Batch[] {
  return [...batches.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
}
