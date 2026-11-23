// Modo headless: `npm run cli -- -p "sua pergunta"`.
// Usa o mesmo núcleo do app (modelo nativo, ferramentas, permissões, skills e hooks).
// Por padrão, ações que pedem permissão são negadas. Use --allow para aprovar tudo (cuidado).
import { createConversation, getSettings, saveSettings } from "./store.ts";
import { runTurn } from "./agent.ts";
import { resolvePermission } from "./permissions.ts";
import type { Mode, StreamEvent } from "./types.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const prompt = arg("-p");
if (!prompt) {
  console.error('Uso: npm run cli -- -p "sua pergunta" [--mode plan|ask|accept_edits|bypass] [--model arquivo.gguf] [--json] [--allow]');
  process.exit(2);
}

const mode = (arg("--mode") as Mode | undefined) ?? undefined;
const model = arg("--model");
const asJson = process.argv.includes("--json");
const allow = process.argv.includes("--allow");

const settings = getSettings();
if (model) saveSettings({ ...settings, defaultModel: model });
const conv = createConversation(prompt.slice(0, 60));
const controller = new AbortController();
const events: StreamEvent[] = [];
let text = "";

await runTurn({
  conversationId: conv.id,
  text: prompt,
  providerId: arg("--provider") ?? settings.defaultProvider,
  model: model ?? settings.defaultModel,
  mode,
  signal: controller.signal,
  emit: (e) => {
    events.push(e);
    if (e.type === "delta") {
      text += e.text;
      if (!asJson) process.stdout.write(e.text);
    }
    if (e.type === "permission") {
      resolvePermission(e.id, allow ? "once" : "deny");
      if (!asJson) process.stderr.write(`\n[permissão ${allow ? "concedida" : "negada"}: ${e.summary}]\n`);
    }
    if (e.type === "tool_result" && !asJson) process.stderr.write(`\n[ferramenta ${e.name}: ${e.ok ? "ok" : "erro"}]\n`);
    if (e.type === "error") process.stderr.write(`\nErro: ${e.message}\n`);
  },
});

if (asJson) {
  process.stdout.write(JSON.stringify({ conversationId: conv.id, text, events }, null, 2) + "\n");
} else {
  process.stdout.write("\n");
}
process.exit(0);
