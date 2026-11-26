// Testes unitários do núcleo. Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseOutput, buildPrompt, stripThinking, extractThinking } from "../native.ts";
import { parseSkill } from "../skills.ts";
import { contextCategories } from "../workspace.ts";
import { lineDiff, toHunks, revertHunks } from "../diff.ts";
import { systemPrompt } from "../agent.ts";
import { tiersOf } from "../providers.ts";
import { parseSearchOutput, parseQueries, dropUnknownCitations, sourcesMarkdown, keywords, relevance } from "../research.ts";
import { resolveInside, permissionKey, describeAction, parseDuckHtml, parseDuckLite, parseBing, parseWikipedia } from "../tools.ts";

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

test("busca: lê resultados do DuckDuckGo com href antes da classe", () => {
  const html = `<div class="result"><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexemplo.com%2Fa&amp;rut=x" class="result__a">Título <b>A</b></a>
    <a class="result__snippet" href="#">Resumo do <b>A</b></a></div>
    <div class="result"><a class="result__a" href="https://exemplo.com/b">B</a><a class="result__snippet">Resumo B</a></div>`;
  const hits = parseDuckHtml(html);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], { title: "Título A", url: "https://exemplo.com/a", snippet: "Resumo do A" });
  assert.equal(hits[1].url, "https://exemplo.com/b");
});

test("busca: lê DuckDuckGo Lite, Bing e Wikipédia", () => {
  const lite = `<tr><td><a rel="nofollow" href="https://site.org/x" class='result-link'>Site X</a></td></tr><tr><td class='result-snippet'>Texto X</td></tr>`;
  assert.deepEqual(parseDuckLite(lite)[0], { title: "Site X", url: "https://site.org/x", snippet: "Texto X" });
  const target = Buffer.from("https://destino.com/p").toString("base64").replace(/=+$/, "");
  const bing = `<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?!&amp;&amp;p=1&amp;u=a1${target}&amp;ntb=1">Destino</a></h2><div class="b_caption"><p>Descrição</p></div></li>`;
  assert.deepEqual(parseBing(bing)[0], { title: "Destino", url: "https://destino.com/p", snippet: "Descrição" });
  const wiki = JSON.stringify({ query: { search: [{ title: "Modelo de linguagem", snippet: "um <span>modelo</span>" }] } });
  assert.equal(parseWikipedia(wiki)[0].url, "https://pt.wikipedia.org/wiki/Modelo_de_linguagem");
  assert.deepEqual(parseWikipedia("não é json"), []);
});
test("contexto: usa o tokenizador quando disponível e estima sem ele", () => {
  const msgs = [{ role: "user", content: "abcdefgh" }, { role: "tool", content: "1234" }];
  const exact = contextCategories(msgs, "sys", (s) => s.length, 100);
  assert.equal(exact.exact, true);
  assert.equal(exact.used, 8 + 4 + 3);
  const est = contextCategories(msgs, "sys", () => null, 100);
  assert.equal(est.exact, false);
  assert.equal(est.used, 2 + 1 + 1);
});
test("diff: separa trechos distantes e reverte só o escolhido", () => {
  const base = Array.from({ length: 20 }, (_, i) => `linha ${i + 1}`);
  const before = base.join("\n");
  const changed = [...base];
  changed[1] = "linha 2 nova";
  changed[17] = "linha 18 nova";
  changed.splice(10, 0, "inserida");
  const after = changed.join("\n");
  const hunks = toHunks(lineDiff(before, after));
  assert.equal(hunks.length, 3);
  assert.ok(hunks[0].lines.includes("-linha 2") && hunks[0].lines.includes("+linha 2 nova"));
  const partial = revertHunks(before, after, [1]).split("\n");
  assert.ok(!partial.includes("inserida"));
  assert.ok(partial.includes("linha 2 nova") && partial.includes("linha 18 nova"));
  assert.equal(revertHunks(before, after, [0, 1, 2]), before);
  assert.equal(revertHunks(before, after, []), after);
});

test("diff: arquivo novo e arquivo igual", () => {
  assert.deepEqual(toHunks(lineDiff("", "a\nb"))[0].lines, ["+a", "+b"]);
  assert.equal(toHunks(lineDiff("x\ny", "x\ny")).length, 0);
});
test("prompt jailbreak entra no prompt de sistema só quando ligado", () => {
  const base = { responseStyle: "normal", customPrompt: "", workspace: "x", jailbreak: false } as any;
  assert.ok(!systemPrompt(base, "ask", []).includes("VXNQR"));
  assert.ok(systemPrompt({ ...base, jailbreak: true }, "ask", []).includes("VXNQR"));
});
test("raciocínio: prompt aberto, extração e limpeza do histórico", () => {
  const msgs = [{ role: "user" as const, content: "oi" }, { role: "assistant" as const, content: "<think>pensei</think>\n\nolá" }];
  const open = buildPrompt([...msgs, { role: "user" as const, content: "e aí?" }], [], true);
  assert.ok(open.endsWith("<|im_start|>assistant\n<think>\n"));
  assert.ok(!open.includes("pensei"));
  assert.ok(buildPrompt(msgs, [], false).endsWith("<think>\n\n</think>\n\n"));
  assert.equal(extractThinking("<think>\nabc\n</think>\n\nresposta"), "abc");
  assert.equal(extractThinking("<think>\nainda pensando"), "ainda pensando");
  assert.equal(stripThinking("<think>x</think>\n\nresposta"), "resposta");
  assert.equal(parseOutput("<think>\ncortou no meio").content, "");
});
test("pesquisa: lê resultados, plano de buscas e citações", () => {
  const out = "Fonte: Bing\n\n1. Título A\nhttps://a.com/x\nResumo A\n\n2. Título B\nhttps://b.org/y\nResumo B";
  assert.deepEqual(parseSearchOutput(out).map((h) => h.url), ["https://a.com/x", "https://b.org/y"]);
  assert.deepEqual(parseQueries('Aqui: ["um", "dois", "um"]', "tema"), ["um", "dois"]);
  assert.deepEqual(parseQueries("1. primeira busca\n2. segunda busca", "tema"), ["primeira busca", "segunda busca"]);
  assert.deepEqual(parseQueries("", "tema"), ["tema"]);
  assert.equal(dropUnknownCitations("Fato [1] e outro [7][2].", 3), "Fato [1] e outro [2].");
  assert.ok(sourcesMarkdown([{ n: 1, title: "A [x]", url: "https://a.com", snippet: "", excerpt: "" }]).includes("[1] [A x](https://a.com)"));
});
test("pesquisa: descarta resultados que não falam do tema", () => {
  const words = keywords("O que é o Model Context Protocol (MCP)?");
  assert.ok(words.includes("model") && words.includes("protocol") && !words.includes("como"));
  assert.ok(relevance(words, "What is the Model Context Protocol?", "") >= 3);
  assert.equal(relevance(words, "Popular 3D models - Sketchfab", "Download free 3D assets"), 1);
  assert.equal(relevance(words, "Receita de bolo", "farinha e ovos"), 0);
});
test("modelos: separa pagos, gratuitos e gratuitos com limites", () => {
  const t = tiersOf([
    { id: "a/pago", pricing: { prompt: "0.000003", completion: "0.000015" } },
    { id: "b/modelo:free", pricing: { prompt: "0", completion: "0" } },
    { id: "openrouter/auto-gratis", pricing: { prompt: 0, completion: 0 } },
    { id: "c/sem-preco" },
  ]);
  assert.deepEqual(t, { "a/pago": "pago", "b/modelo:free": "limitado", "openrouter/auto-gratis": "gratuito" });
});