# Relatório — Zenith Code 1.0 (primeira build)

Data: 22/11/2026. Escopo: a primeira build executável do plano (docs 01 a 05), com foco no núcleo: chat com modelos locais e de nuvem, agente de código com permissões, ferramentas, skills, hooks, terminal e desfazer.

## 1. O que foi construído

| Área | Entregue nesta build | Arquivo principal |
|---|---|---|
| Provedores de modelo | Ollama (API nativa), OpenAI-compatível (LM Studio, llama.cpp, OpenAI, OpenRouter), Anthropic. Streaming e chamadas de ferramenta em todos | `server/providers.ts` |
| Persistência | SQLite nativo do Node 22 (`node:sqlite`): conversas, mensagens, configurações, checkpoints. Sem dependência nativa para compilar | `server/store.ts` |
| Agente | Loop de até 15 passos: modelo chama ferramentas, recebe resultado e continua. Histórico limitado a 80 mensagens | `server/agent.ts` |
| Ferramentas | `list_dir`, `read_file`, `search_text`, `write_file`, `edit_file`, `run_command` (PowerShell no Windows), `web_search`, `web_fetch`, `load_skill`. Arquivos limitados à pasta de trabalho | `server/tools.ts` |
| Permissões | Quatro modos: Perguntar, Aceitar edições, Plano (somente leitura), Sem aprovação. "Sempre permitir" por padrão de comando | `server/agent.ts`, `server/permissions.ts` |
| Skills | Formato `SKILL.md` com frontmatter; carregamento por pasta; comando `/nome`; ferramenta `load_skill`. Exemplo: `skills/revisar-codigo` | `server/skills.ts` |
| Hooks | `PreToolUse` (código 2 bloqueia) e `PostToolUse` a partir de `.zenith/hooks.json` | `server/hooks.ts` |
| Checkpoints | Antes de cada escrita, guarda o conteúdo anterior. Botão **Desfazer** restaura a última alteração | `server/store.ts`, `server/index.ts` |
| Servidor | HTTP em 127.0.0.1:5178, eventos por SSE, interface estática, API de conversas, configurações, busca, modelos, terminal | `server/index.ts` |
| Interface | Barra lateral com conversas (fixar, renomear, excluir, buscar), chat com Markdown sanitizado, cartões de ferramenta e de permissão, seletor de provedor, modelo e modo, painel de configurações, terminal | `src/App.tsx`, `src/components/` |
| Terminal | Comandos digitados pelo usuário na pasta de trabalho | `src/components/Terminal.tsx` |

## 2. Como foi testado (testes mínimos, para economizar tokens)

- **Compilação:** `tsc --noEmit` sem erros; `vite build` concluído.
- **Fluxo completo na interface (prints tirados no navegador embutido, sem controle de computador):**
  1. Chat com provedor de teste (servidor OpenAI-compatível local, fora do projeto) pediu `write_file`.
  2. Cartão de permissão apareceu com a ação e os botões. Após "Permitir uma vez", o arquivo foi criado em `workspace/hello.md` e a resposta final apareceu.
  3. Configurações abriram com provedores, modo, pasta de trabalho e busca SearXNG.
- **Desfazer:** teste via API. Uma segunda escrita com modo "aceitar edições" foi desfeita, e o conteúdo anterior voltou.
- **Não testado:** Ollama real (não está instalado nesta máquina), Anthropic e OpenAI reais, busca web real, hooks em execução, modo plano em uso real, terminal pela interface.

## 3. Desvios do plano (doc 03)

| Plano | Build 1.0 | Motivo |
|---|---|---|
| Electron (desktop) | App web local servido pelo próprio núcleo (abre no navegador) | Mais rápido de entregar e de testar; o mesmo núcleo pode ser empacotado em Electron depois |
| node-pty (PTY real) | Terminal por comando (sem sessão interativa) | Evita compilação nativa no Windows nesta build |
| Banco com FTS5 | Busca por `LIKE` | Suficiente para a primeira build |
| Sandbox obrigatória (passo 18) | Não implementada. Permissões e hooks são o controle | Fica para a próxima build; é o item de maior risco |
| Controle de computador | Não implementado (excluído a seu pedido) | Economia de tokens |

## 4. Estado em relação às 126 funções (doc 01)

**Implementadas em forma básica (18):** F001 chat, F002 seleção de modelo, F005 streaming, F006 interromper, F010 gerir conversas, F011 busca no histórico, F015 renderização Markdown, F047 pesquisa web, F053 skills, F066 ler e editar arquivos, F067 executar comandos, F068 modos de permissão, F069 modo plano, F072 hooks, F102 streaming por eventos, F103 tool use, F104 loop de ferramentas, F113 busca web equivalente.

**Parciais (7):** F023 comandos com `/` (só skills), F071 comandos de barra (só `/skills`), F076 checkpoints (só desfazer o último), F084 configuração (uma camada), F096 atalhos (só Enter), F097 temas (só escuro), F098 idiomas (só português).

**Não implementadas (101):** entre elas, todas as de Claude Code avançado (subagentes, CLI, worktrees, LSP, `/init`, `/memory`, `/doctor`), artifacts, projetos, memória, voz, reuniões, Cowork, agendamento, extensão de navegador, MCP, plugins, marketplace, fullstack, pesquisa profunda, exportação, anexos, imagens e web/mobile remoto.

Para a lista completa, ver [docs/01-funcoes-claude.md](01-funcoes-claude.md) e [docs/03-plano-desenvolvimento.md](03-plano-desenvolvimento.md).

## 5. Recomendações da crítica (doc 04) aplicadas nesta build

| Recomendação | Situação |
|---|---|
| Permissão por padrão negativo | Aplicada: escrita, comando e web pedem aprovação no modo padrão |
| Modo plano somente leitura | Aplicada |
| Checkpoints e rewind | Aplicada de forma básica (desfazer o último) |
| Hooks de ciclo de vida | Aplicada (`PreToolUse` e `PostToolUse`) |
| Sandbox para comandos de terceiros | **Não aplicada** |
| Auditoria local completa | **Parcial**: o histórico guarda cada chamada e resultado, mas não há tela de auditoria |
| Suíte de avaliação de chamadas de ferramenta | **Não aplicada** |
| Tarefas de referência (30) | **Não criadas** |
| Mobile e modo web com pareamento | **Parcial**: o modo web existe (é o próprio app), sem pareamento |

## 6. Próximos passos (ordem sugerida)

1. Instalar Ollama e testar com um modelo de chamada de ferramenta (ex.: `qwen2.5-coder`). Registrar o resultado na suíte de avaliação.
2. Sandbox para `run_command` e para skills e hooks de terceiros (passo 18 do plano).
3. Conversas com ramificação, exportação em Markdown e JSON, e anexos de arquivo (passos 9 a 13).
4. MCP cliente em stdio (passo 25), que libera conectores.
5. Projetos com instruções e base de arquivos (passos 12 e 13).
6. Artifacts com pré-visualização de HTML (passo 14).

## 7. Como rodar

```powershell
npm install
npm run build
npm start
```

Depois, abrir http://127.0.0.1:5178.
