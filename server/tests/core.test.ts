// Testes unitários do núcleo. Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseOutput, buildPrompt } from "../native.ts";
import { parseSkill } from "../skills.ts";
import { resolveInside, permissionKey, describeAction } from "../tools.ts";

test("parseOutput lê chamada de ferramenta em <tool_call>", () => {
  const raw = 'Vou criar o arquivo.\n<tool_call>\n{"name": "write_file", "arguments": {"path": "a.md", "content": "oi"}}\n</tool_call>';
  const out = parseOutput(raw);
  assert.equal(out.toolCalls.length, 1);
  assert.equal(out.toolCalls[0].name, "write_file");
  assert.deepEqual(out.toolCalls[0].args, { path: "a.md", content: "oi" });
  assert.equal(out.content, "Vou criar o arquivo.");
});

test("parseOutput aceita JSON solto como reserva e remove o bloco do texto", () => {
  const raw = '{"name": "list_dir", "arguments": {"path": ""}}';
  const out = parseOutput(raw);
  assert.equal(out.toolCalls[0].name, "list_dir");
  assert.equal(out.content, "");
});

test("parseOutput remove bloco de raciocínio e não confunde JSON comum com ferramenta", () => {
  const raw = "<think>pensando</think>Resposta: {\"valor\": 1}";
  const out = parseOutput(raw);
  assert.equal(out.toolCalls.length, 0);
  assert.equal(out.content, 'Resposta: {"valor": 1}');
});

test("buildPrompt inclui ferramentas no formato ChatML e fecha o turno do assistente", () => {
  const prompt = buildPrompt(
    [{ role: "system", content: "Seja breve." }, { role: "user", content: "oi" }],
    [{ name: "list_dir", description: "lista", parameters: { type: "object" } }],
  );
  assert.match(prompt, /<\|im_start\|>system\nSeja breve\./);
  assert.match(prompt, /<tools>/);
  assert.match(prompt, /<\|im_start\|>user\noi<\|im_end\|>/);
  assert.ok(prompt.endsWith("<|im_start|>assistant\n<think>\n\n</think>\n\n"));
});

test("parseSkill lê frontmatter com name e description", () => {
  const skill = parseSkill("---\nname: teste\ndescription: faz algo\n---\n\nCorpo da skill.", "/x");
  assert.ok(skill);
  assert.equal(skill!.name, "teste");
  assert.equal(skill!.description, "faz algo");
  assert.equal(skill!.body, "Corpo da skill.");
});

test("parseSkill rejeita arquivo sem frontmatter válido", () => {
  assert.equal(parseSkill("sem frontmatter", "/x"), null);
});

test("resolveInside bloqueia caminho que sai da pasta de trabalho", () => {
  const ws = path.resolve("/tmp/ws");
  assert.equal(resolveInside(ws, "a/b.txt"), path.join(ws, "a", "b.txt"));
  assert.throws(() => resolveInside(ws, "../fora.txt"), /fora da pasta/);
});

test("permissionKey agrupa comandos pelo primeiro termo", () => {
  assert.equal(permissionKey("run_command", { command: "npm install express" }), "run_command:npm");
  assert.equal(permissionKey("write_file", { path: "x" }), "write_file");
});

test("describeAction resume comandos para o cartão de permissão", () => {
  assert.equal(describeAction("run_command", { command: "npm test" }), "Executar: npm test");
});
