# Zenith — documentação do planejamento

Aplicativo próprio com a mesma capacidade do Claude (app, Claude Code e Cowork) para rodar modelos locais e de nuvem: chat, projetos, artifacts, agente de código, terminal, skills, plugins, MCP, pesquisa, automação e voz.

Escopo: **sem conta, sem login, sem telemetria e sem uso de dados para treinamento ou monitoramento.**

| Documento | Conteúdo |
|---|---|
| [01-funcoes-claude.md](01-funcoes-claude.md) | Inventário de 126 funções ativas (F001–F136) e a lista de itens removidos |
| [02-interface-claude.md](02-interface-claude.md) | Inventário de 83 elementos de interface (UI-001–UI-083) |
| [03-plano-desenvolvimento.md](03-plano-desenvolvimento.md) | Plano de 30 passos em 9 fases, com a cobertura de funções por passo |
| [04-critica-comparativa.md](04-critica-comparativa.md) | Mapeamento função por função, limitações assumidas e crítica |
| [05-plano-interface.md](05-plano-interface.md) | Plano de interface: layout, 35 telas, componentes, fluxos e critérios de aceite |

## Números principais

- Funções ativas: **126**.
- Planejadas com passo e critério: **126 (100%)**.
- Paridade completa planejada: **121 (96,0%)**.
- Paridade parcial declarada: **5** (controle de tela e extensão de navegador, mobile só PWA, complemento do Office, LSP por linguagem).

A cifra mede planejamento. A paridade de qualidade depende da suíte de avaliação (passo 15) e de tarefas de referência (documento 04, seção 4.9).

## Premissas

- Nome provisório: **Zenith** (nome da pasta do projeto).
- Stack proposta: Electron, React, TypeScript, Node embutido, SQLite, xterm.js, node-pty, Monaco, Ollama e compatíveis com a API OpenAI.
- Os 30 passos foram mantidos; cada um ficou maior. Dez são G+ ou G++.
- Itens marcados "(verificar)" no documento 01 precisam ser confirmados nas fontes oficiais antes do passo onde são entregues.
