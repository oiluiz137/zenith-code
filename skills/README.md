# Skills do Zenith Code

Pasta lida pelo app: `skills/<nome>/SKILL.md`. Cada skill tem frontmatter com `name` e `description`.

## Origem de cada skill

### Copiadas do ambiente local (com a licença verificada ou indicada)

| Skill | Origem local | Licença |
|---|---|---|
| teardown | `~/.claude/skills/teardown` (com `docs/`, `sims/`, `sfx/`; `node_modules` não copiado) | MIT (arquivo LICENSE incluído na pasta) |
| brainstorming, diagnosing-superpowers, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills | `~/.claude/skills/<nome>` | **Não verificada** localmente. Confirmar a licença antes de distribuir |

### Não copiada

| Skill | Motivo |
|---|---|
| g0dm0d3-reference | Contém um prompt de sistema pensado para contornar as regras de segurança de modelos. Não foi copiado para o projeto. |

### Escritas do zero (equivalentes às skills proprietárias do Claude)

Estas skills são originais. Seguem a função de cada skill do Claude, mas o texto foi escrito para o Zenith:

docx, pdf, pptx, xlsx, deep-research, skill-creator, consolidate-memory, explain-usage, morning, setup-zenith, schedule, loop, run-app, init-project, simplify, code-review, security-review, fewer-permission-prompts, keybindings-help, update-config, claude-api, plugin-authoring, dataviz, corte-viral, vox-explainer, obsidian-notes, docs, google-workspace, import-memory, computer-use, browser-control.

Status das que dependem de funções ainda não implementadas (schedule, computer-use, browser-control, google-workspace, plugin-authoring): marcadas no próprio arquivo.

## Como usar

No chat, digite `/nome-da-skill` seguido do pedido. O modelo também carrega a skill sozinho quando a descrição combina com o pedido.
