# 02 — Inventário da interface (escopo revisado)

Descreve o que existe em cada superfície do ecossistema Claude e o que o Zenith precisa oferecer para igualar as **capacidades**. Não descreve aparência. IDs `UI-xxx` são usados no documento 05.

Superfícies: **Web/Desktop**, **Mobile**, **Claude Code** (terminal e IDE), **Cowork** (agente de desktop).

Removidos nesta revisão: elementos de conta (menu de conta, uso e limites, privacidade de treinamento, compartilhamento com equipe, reautenticação de conta).

---

## 1. Estrutura geral (Web/Desktop)

| ID | Região | Conteúdo |
|---|---|---|
| UI-001 | Barra lateral | Novo chat, busca, projetos, conversas agrupadas por data |
| UI-002 | Área central | Mensagens em coluna de leitura |
| UI-003 | Compositor | Campo de texto com anexo, ferramentas, modelo, modo e envio |
| UI-004 | Painel lateral | Artifacts, previews, diffs, fontes |
| UI-005 | Menu de preferências | Acesso às configurações, idioma e ajuda (sem conta) |
| UI-006 | Configurações | Abas: geral, modelos, provedores, agente, memória, skills, plugins, MCP, web, aparência, idioma, atalhos, dados locais, sobre |
| UI-007 | Barra superior da conversa | Título, projeto, compartilhar, mais opções |
| UI-008 | Tela inicial | Saudação, sugestões de início e campo de entrada |

## 2. Elementos de mensagem

| ID | Elemento | Função |
|---|---|---|
| UI-009 | Bloco de raciocínio | Colapsável, com contagem de tokens |
| UI-010 | Cartão de ferramenta | Nome, argumentos resumidos, status, duração, detalhe |
| UI-011 | Citações | Números clicáveis que abrem a fonte |
| UI-012 | Cartão de arquivo | Anexo com nome, tipo e ação de abrir |
| UI-013 | Ações da mensagem | Copiar, editar, regenerar, feedback local, compartilhar |
| UI-014 | Ramificações | Setas para alternar versões |
| UI-015 | Blocos de código | Realce, linguagem, cópia |
| UI-016 | Tabelas e LaTeX | Renderização formatada |
| UI-017 | Estados de geração | Pensando, escrevendo, interrompido |
| UI-018 | Marcador de checkpoint | Linha na conversa com "restaurar aqui" |

## 3. Compositor

| ID | Controle | Função |
|---|---|---|
| UI-019 | Anexar | Arquivo, imagem colada, arrastar e soltar |
| UI-020 | Seletor de modelo | Modelo com selo local ou nuvem e capacidades |
| UI-021 | Ferramentas da conversa | Toggles de web, skills, MCP, terminal, conectores |
| UI-022 | Seletor de modo | Chat, agente, plano, sem aprovação |
| UI-023 | Estilo de resposta | Estilo ativo da conversa |
| UI-024 | Ditado e modo de voz | Botão de ditado e conversa falada |
| UI-025 | Contador de contexto | Barra de uso aproximado do contexto |
| UI-026 | Enviar e parar | Alterna conforme o estado |
| UI-027 | Menus `/` e `@` | Comandos, skills, plugins, arquivos, servidores |
| UI-028 | Modo Vim | Indicador de modo no campo de prompt |

## 4. Projetos e memória

| ID | Tela | Conteúdo |
|---|---|---|
| UI-029 | Página do projeto | Conversas do projeto e campo próprio |
| UI-030 | Instruções do projeto | Editor de instruções |
| UI-031 | Base de conhecimento | Arquivos, estado de indexação, adicionar e remover |
| UI-032 | Memória | Ver, editar, apagar e pausar lembranças, global e por projeto |

## 5. Artifacts

| ID | Elemento | Função |
|---|---|---|
| UI-033 | Cabeçalho | Título, tipo, versão |
| UI-034 | Alternador código e preview | Abas |
| UI-035 | Barra de ações | Copiar, baixar, publicar, tela cheia |
| UI-036 | Histórico de versões | Lista com restauração |
| UI-037 | Área isolada | Iframe para HTML, React, SVG, Mermaid |

## 6. Código e agente (Claude Code e IDE)

| ID | Elemento | Função |
|---|---|---|
| UI-038 | Prompt de entrada | Multilinha, histórico, autocompletar, modo Vim |
| UI-039 | Saída de ferramentas | Blocos colapsáveis de comandos, leituras e edições |
| UI-040 | Diff de edição | Antes e depois, aceitar ou rejeitar por trecho |
| UI-041 | Painel de permissão | Permitir uma vez, permitir sempre para o padrão, negar |
| UI-042 | Lista de tarefas | Plano e todo atualizados durante a execução |
| UI-043 | Barra de status | Modelo, diretório, contexto, ramo, subagente ativo |
| UI-044 | Menu de comandos | Pesquisável, com comandos, skills e recursos MCP |
| UI-045 | Seletor de modo | Padrão, aceitar edições, plano, sem aprovação |
| UI-046 | Seletor de sessão | Retomar sessões anteriores |
| UI-047 | Indicador de subagente | Nome, tarefa, progresso, resumo |
| UI-048 | Editor de código | Árvore, abas, Monaco |
| UI-049 | Painel de git | Status, commits, branches, PRs |
| UI-050 | Worktrees | Lista e criação de worktree por tarefa |
| UI-051 | Terminal | Abas, saída, processos em segundo plano, encerrar |
| UI-052 | Diagnóstico | Resultado do `/doctor` com correções sugeridas |
| UI-053 | Estilo de saída | Seletor de estilo |
| UI-054 | Pesquisa de símbolos | Ir à definição e referências (LSP) |

## 7. Cowork e automação

| ID | Elemento | Função |
|---|---|---|
| UI-055 | Escolha de pastas | Conceder acesso a pastas específicas |
| UI-056 | Painel de tarefa | Passos, arquivos alterados, progresso |
| UI-057 | Pedido de permissão | Confirmação para ações sensíveis |
| UI-058 | Painel de agendamentos | Lista de tarefas recorrentes, próximo disparo, histórico |
| UI-059 | Controle de computador | Visualização da tela, indicador de ação em curso, parar |
| UI-060 | Status da extensão de navegador | Conectado ou não, páginas acessíveis |
| UI-061 | Painel de equipe de agentes | Sessões, tarefas compartilhadas, mensagens |
| UI-062 | Painel de hooks | Lista por evento, log de disparos |
| UI-063 | Painel de MCP | Servidores, estado, log, ferramentas |

## 8. Pesquisa, voz e reuniões

| ID | Elemento | Função |
|---|---|---|
| UI-064 | Painel de pesquisa profunda | Plano, fontes em tempo real, relatório |
| UI-065 | Painel de sessão proativa | Tema acompanhado, atualizações propostas |
| UI-066 | Indicador de voz | Escuta, transcrição, fala, interromper |
| UI-067 | Gravador de reunião | Iniciar, pausar, resumo ao final |
| UI-068 | Painel de dados e gráficos | Tabela, gráfico gerado, código executado |

## 9. Janela rápida, bandeja e extensões

| ID | Elemento | Função |
|---|---|---|
| UI-069 | Janela rápida | Campo flutuante com atalho global |
| UI-070 | Ícone da bandeja | Estado do agente, abrir, sair |
| UI-071 | Marketplace de plugins e extensões | Catálogo, permissões antes de instalar |
| UI-072 | Pareamento de sessão remota | Código de uso único para acessar pelo navegador |

## 10. Mobile (PWA)

| ID | Elemento | Função |
|---|---|---|
| UI-073 | Barra de abas inferior | Conversas, projetos, configurações |
| UI-074 | Folhas | Modelo, anexos, ferramentas em painéis deslizantes |
| UI-075 | Entrada por voz | Ditado e modo de voz em tela cheia |
| UI-076 | Câmera e fotos | Anexar foto direta da câmera |

## 11. Estados e transversais

| ID | Estado | Comportamento |
|---|---|---|
| UI-077 | Provedor fora do ar | Banner com troca de provedor, sem perder o texto |
| UI-078 | Modelo sem ferramentas | Aviso e fallback visível |
| UI-079 | Resposta interrompida | Marcação e opção de continuar |
| UI-080 | Erro de rede | Tentar de novo sem perder o texto |
| UI-081 | Atalhos globais | Paleta, nova conversa, trocar modelo, janela rápida |
| UI-082 | Responsividade | Layout de uma coluna em telas estreitas |
| UI-083 | Agente travado | Botão de parar após tempo sem progresso |

---

## Totais

- **83 elementos de interface** (UI-001 a UI-083), mais os controles de Claude Code e Cowork incluídos nas seções 6 a 9.
- Elementos removidos nesta revisão: menu de conta, uso e limites, privacidade de treinamento, compartilhamento com equipe e reautenticação de conta.
