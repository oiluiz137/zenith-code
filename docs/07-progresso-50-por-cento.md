# Progresso do Zenith Code 1.0 — rodada 2

Data: 22/11/2026. Objetivo da rodada: integrar modelo nativo (sem servidor), baixar e testar o Qwen, e avançar até cerca de 50% do plano de 30 passos (doc 03).

## 1. Entregas desta rodada

| Item | Situação | Onde está |
|---|---|---|
| Imagens de referência da interface do Claude | 3 imagens baixadas de artigos de ajuda públicos (19 KB, 3,5 KB, 7,7 KB). Só para referência; não entram no app | `docs/referencias-visuais/` |
| Modelo Qwen3-8B, quantização Q4_K_M (GGUF, 4,8 GB) | Baixado de `Qwen/Qwen3-8B-GGUF` no Hugging Face e verificado (cabeçalho GGUF e tamanho). Fica em `models/`, fora do git | `models/Qwen3-8B-Q4_K_M.gguf` |
| Runtime nativo | llama.cpp carregado **dentro do processo do Zenith** via `node-llama-cpp` 3.8.1. Sem Ollama, sem LM Studio, sem servidor, sem porta | `server/native.ts` |
| Provedores padrão | Ollama e LM Studio removidos. Padrão: "Modelo local (nativo, GGUF)". Nuvem: OpenAI, OpenRouter e Anthropic | `server/providers.ts`, `server/store.ts` |
| Chamada de ferramenta no modelo local | Prompt no formato ChatML do Qwen, ferramentas em `<tools>`, resposta em `<tool_call>`. Reserva para JSON solto | `server/native.ts` |
| Projetos | Criar, editar, excluir; instruções; arquivos de texto como referência; conversa atribuída a um projeto; recuperação por palavras-chave | `server/store.ts`, `server/agent.ts`, `src/components/ProjectModal.tsx` |
| Anexos de texto | Clipe no compositor; limite de 300 KB por arquivo | `src/App.tsx` |
| Exportar | Markdown e JSON da conversa | `server/index.ts` |
| Editar e reenviar | Apaga a partir da mensagem editada e envia de novo. Não há árvore de ramificações | `src/App.tsx` |
| Artifact HTML | Blocos ```html viram botão de pré-visualização em iframe `sandbox="allow-scripts"` | `src/components/ArtifactPreview.tsx` |
| CLI headless | `npm run cli -- -p "pergunta" --mode ... --model ... [--allow] [--json]` | `server/cli.ts` |
| Memória do usuário | Editável em Configurações; entra no prompt de todas as conversas | `server/agent.ts`, `src/components/SettingsModal.tsx` |
| Cliente MCP (stdio) | Lê `.zenith/mcp.json`, lista e chama ferramentas `mcp__<servidor>__<ferramenta>`. Sempre pede permissão | `server/mcp.ts` |
| Terminal com atalhos | Botões de `git status`, `git diff --stat`, `git log`, `npm test` | `src/components/Terminal.tsx` |
| Testes unitários | 9 testes do núcleo (parser de saída, prompt, skills, caminhos, permissões). `npm test` | `server/tests/core.test.ts` |

## 2. Testes feitos com o modelo real

- **Inferência:** "Responda em uma frase: qual é a capital do Brasil?" → "A capital do Brasil é Brasília." (CLI, modo plano).
- **Chamada de ferramenta:** pedido para criar `qwen-teste.md` em modo "aceitar edições". O modelo chamou `write_file`, o arquivo foi criado com o conteúdo pedido, e o modelo confirmou em uma frase.
- **Interface (print):** pergunta no chat pela interface com o modelo nativo. A resposta chegou e ficou no histórico.
- **Desfazer:** testado na rodada anterior (API).
- **MCP:** servidor de teste de eco configurado em `workspace/.zenith/mcp.json`. A conexão e a listagem funcionam (`mcp__eco__echo`). A chamada pelo modelo não foi concluída (ver seção 5).

## 3. Problemas encontrados e como foram resolvidos

| Problema | Causa | Solução |
|---|---|---|
| `node-llama-cpp` 3.22.3 travava com exit `0xC0000005` em `loadBackends()` | Binário da versão nova falha nesta máquina (Intel i5-1135G7, Windows 11) | Fixado em 3.8.1 (llama.cpp b5415), que carrega e roda |
| Segunda chamada no mesmo turno falhava com "No sequences left" | Cada geração criava uma nova sequência de contexto | Uma sequência por modelo, criada uma vez |
| Modelo emitia JSON de ferramenta sem as tags | Comportamento do modelo | Parser de reserva com objetos balanceados; resposta que começa com `{` ou ``` só aparece no fim |
| Download do GGUF lento (1,4 MB/s) | Conexão única | Partes em paralelo (6 faixas HTTP) e montagem verificada pelo tamanho total |
| Configuração MCP não lida | Arquivo gravado com BOM do PowerShell | Gravação em UTF-8 sem BOM |

## 4. Estado em relação ao plano (30 passos)

Critério: **feito** = 1 ponto; **parcial** = 0,5 ponto; **não iniciado** = 0.

| Passo | Estado | Observação |
|---|---|---|
| 1 Escopo e matriz | Feito | docs 01 a 05 |
| 2 Monorepo e qualidade | Parcial | TypeScript strict, `build`, `typecheck`, `test`. Sem E2E nem CI |
| 3 Shell e interface | Parcial | Web local, tema escuro, pt-BR, Enter envia. Sem janela rápida, bandeja, inglês |
| 4 Armazenamento e configuração | Parcial | SQLite nativo, configurações, memória. **Chaves em texto no SQLite local (sem cofre)**. Sem camadas de configuração |
| 5 Provedores e API | Parcial | Nativo, OpenAI-compatível, Anthropic. Sem cache, lote nem API de arquivos |
| 6 Capacidades e raciocínio | Parcial | Contexto fixo de 8192 tokens. Sem esforço configurável |
| 7 Gestão de provedores | Parcial | Teste pela lista de modelos. Sem baixar modelo pela UI |
| 8 Parâmetros e tokens | Parcial | Estimativa de tokens (caracteres / 4). Sem estilos |
| 9 Chat e entrada | Parcial | Streaming, parar, Markdown, anexos de texto, comandos `/`. Sem voz, imagem, feedback |
| 10 Conversas e busca | Feito | Fixar, renomear, excluir, buscar, retomar |
| 11 Edição, exportação | Parcial | Exporta MD e JSON; editar e reenviar. Sem ramificações nem PDF |
| 12 Projetos | Feito | Instruções, arquivos, conversas por projeto, memória do projeto |
| 13 Base de conhecimento | Parcial | Arquivos de texto, busca por palavras. Sem PDF, OCR, embeddings, reuniões |
| 14 Artifacts | Parcial | HTML em sandbox. Sem Markdown/SVG/Mermaid em painel, sem versões |
| 15 Agente, CLI, SDK | Parcial | Loop, fallback, `-p`. Sem CLI interativa, SDK publicado nem suíte de avaliação |
| 16 Permissões | Feito | Quatro modos, "sempre permitir", plano. Sem tela de auditoria |
| 17 Arquivos e checkpoints | Parcial | Ler, buscar, criar, editar, desfazer o último. Sem rewind de conversa |
| 18 Terminal e sandbox | Parcial | Terminal por comando, sem PTY, sem sandbox, sem `/doctor` |
| 19 Editor, LSP, IDEs | Não iniciado | — |
| 20 Git e worktrees | Parcial | Atalhos de git no terminal. Sem worktrees nem tela de PR |
| 21 Subagentes e equipes | Não iniciado | — |
| 22 Skills e comandos | Parcial | `SKILL.md`, `/nome`, `load_skill`, `/skills`. Sem `/init`, `/memory` |
| 23 Plugins e marketplace | Não iniciado | — |
| 24 Hooks | Parcial | `PreToolUse` e `PostToolUse`. Sem `Stop`, `SessionStart` |
| 25 MCP e conectores | Parcial | Cliente stdio testado. Sem HTTP/SSE, sem tela de gestão |
| 26 Pesquisa | Parcial | Busca web e leitura de página. Sem pesquisa profunda, sem citações numeradas |
| 27 Fullstack e dados | Não iniciado | — |
| 28 Memória | Parcial | Memória global e de projeto. Sem compactação automática |
| 29 Automação | Não iniciado | — |
| 30 Web, mobile, release | Parcial | Modo web local (o próprio app). Sem PWA, sem instalador |

**Pontuação:** 4 feitos + 21 parciais + 5 não iniciados. Com o critério acima: (4 + 21 × 0,5) / 30 = **48%**. É o marco de "cerca de 50%" pedido, com ressalva: a maioria dos passos está em versão básica.

## 5. Pendências e riscos

- **Chaves de API em texto no banco local.** O passo 4 pede cofre do sistema. Não foi feito. Antes de uso com chaves reais, criptografar ou usar o cofre do Windows.
- **Sandbox ausente.** `run_command` e servidores MCP rodam com as permissões do usuário. O modo padrão pede aprovação, mas o modo "sem aprovação" não tem barreira.
- **Desempenho no CPU.** A primeira resposta leva cerca de 2 a 3 minutos (carga do modelo de 4,8 GB). As seguintes são mais rápidas. Medição formal ainda não feita.
- **Versão fixada do runtime.** `node-llama-cpp` 3.8.1. Atualizar só depois de testar a carga do modelo.
- **Memória do Node.** `node:sqlite` ainda é experimental e mostra aviso ao iniciar.
- **Execução MCP pelo modelo: não verificada.** A conexão e a listagem funcionam. A chamada pelo modelo foi interrompida depois de mais de 10 minutos. Causa provável: geração lenta no CPU com limite de 2048 tokens, sem parada antecipada. Próximo passo: reduzir o limite de tokens para ferramentas e medir a velocidade real.
- **Imagens de referência.** São de propriedade da Anthropic. Não devem ser incluídas no app.

## 6. Como rodar

```powershell
npm install
npm run build
npm start
```

Abrir http://127.0.0.1:5178. O modelo local já está em `models/Qwen3-8B-Q4_K_M.gguf`.

CLI:

```powershell
npm run cli -- -p "Liste os arquivos da pasta de trabalho" --mode plan --model Qwen3-8B-Q4_K_M.gguf
```

Testes:

```powershell
npm test
```
