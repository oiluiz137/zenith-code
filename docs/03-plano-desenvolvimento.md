# 03 — Plano de desenvolvimento do Zenith (30 passos, escopo de paridade)

Objetivo: um aplicativo próprio com a **mesma capacidade** do Claude (app, Claude Code e Cowork) para o escopo definido no documento 01 (126 funções ativas), rodando modelos locais e de nuvem.

Os 30 passos foram mantidos conforme o pedido inicial. Para cobrir 95% ou mais da paridade, **cada passo ganhou mais entregáveis** e a maioria é de tamanho **G** ou **G+**. Isso aumenta o risco de prazo; a crítica está no documento 04.

Cada passo lista os IDs de função que entrega (`F...`) e os itens de interface (`UI-...`) do documento 02, quando houver.

## Princípios de escopo

- **Sem conta, sem login de usuário, sem telemetria, sem envio de conversas.** Nenhum dado sai do computador, exceto para os provedores e serviços que o usuário configurar.
- **Credenciais locais:** chaves de API e tokens de conectores ficam no cofre do sistema.
- **Pareamento local:** o acesso remoto (passo 30) usa código de uso único na rede local, sem conta.
- **Um só núcleo:** desktop, web, CLI e extensões usam o mesmo núcleo de agente. Nada é reimplementado por interface.

## Decisões técnicas base (ADR-000)

| Área | Escolha | Motivo |
|---|---|---|
| Shell desktop | **Electron** + Vite | Terminal (PTY), processos, automação de tela e instalação em Windows, macOS e Linux |
| Linguagem | **TypeScript** (strict) em todo o projeto | Um idioma para UI, núcleo, plugins e extensões |
| Servidor do núcleo | **Node.js** embutido no app e também executável sozinho | Permite o modo web, o modo CLI e o modo remoto com o mesmo código |
| UI | **React** + Tailwind + Radix UI | Componentes acessíveis, sem aparência fixa |
| Editor | **Monaco** | Mesmo motor do VS Code |
| Terminal | **xterm.js** + **node-pty** | Terminal real (PowerShell, cmd, WSL, bash) |
| Persistência | **SQLite** (better-sqlite3) + FTS5 | Local, rápido, sem servidor |
| Vetores | **sqlite-vec** | Busca semântica local |
| Modelos locais | **Ollama**, **llama.cpp server**, **LM Studio** | Cobre os três caminhos mais usados |
| Modelos de nuvem | Anthropic, OpenAI, OpenRouter e compatíveis | Mesma interface de provedor |
| Voz | **whisper.cpp** (transcrição local) e síntese local ou do provedor | Ditado e conversa sem enviar áudio a terceiros |
| Automação de tela | Captura e entrada por API nativa do sistema | Controle de computador com aprovação |
| Contratos | **Zod** | Validação de IPC, configuração e manifestos |
| Testes | **Vitest**, **Playwright** (E2E), testes de avaliação de modelos | Unidade, interface e qualidade do agente |
| Empacotamento | **electron-builder** (NSIS, MSIX, DMG, AppImage) | Instaladores por sistema |

Estrutura de pastas (pnpm workspaces):

```
zenith/
  apps/desktop/        Electron: main, preload, renderer (React)
  apps/web/            build web do mesmo renderer (modo servidor)
  apps/mobile/         PWA do renderer com ajustes de toque
  packages/core/       agente, conversas, permissões, eventos, memória
  packages/providers/  Ollama, OpenAI-compatível, Anthropic, OpenAI, OpenRouter
  packages/tools/      arquivos, shell, web, git, LSP, automação de tela
  packages/skills/     carregador de SKILL.md e comandos
  packages/plugins/    SDK, manifesto, marketplace, verificação estática
  packages/hooks/      eventos e execução de hooks
  packages/mcp/        cliente MCP (stdio, HTTP, SSE)
  packages/voice/      ditado, conversa falada, transcrição de reuniões
  packages/schedule/   agendamento de tarefas
  packages/cli/        zenith (interativo) e zenith -p (headless)
  packages/sdk/        biblioteca pública do núcleo
  extensions/vscode/   extensão do VS Code
  extensions/jetbrains/ plugin do JetBrains
  extensions/browser/  extensão de navegador (Chromium)
  extensions/office/   complemento para Office
```

---

## Fase 0 — Fundação (passos 1–4)

### Passo 1 — Escopo, matriz de paridade e critérios
- **Objetivo:** congelar a definição de paridade e medir o progresso.
- **Entregáveis:**
  - Matriz com as 126 funções ativas do documento 01, cada uma com passo, critério de aceite e nível (completo ou parcial com limitação declarada).
  - Lista de itens removidos (documento 01, seção "Removidos do escopo").
  - ADR-000 e ADRs próprios para electron, núcleo embutido e modo web.
  - Regra de identidade: nome, paleta, textos e prompts são próprios; nada copiado do Claude.
  - Lista de limitações assumidas por plataforma.
- **Aceite:** toda função ativa tem passo; limitações revisadas e aprovadas pelo dono do projeto.
- **Tamanho:** P.

### Passo 2 — Monorepo, qualidade e CI
- **Objetivo:** base verificável desde o início.
- **Entregáveis:** pnpm workspaces; TypeScript strict; ESLint; Prettier; Vitest; Playwright; scripts `dev`, `build`, `test`, `lint`, `e2e`; pipeline de CI que roda em Windows, macOS e Linux.
- **Aceite:** build e testes verdes nos três sistemas com um teste por pacote.
- **Tamanho:** M.

### Passo 3 — Shell, interface base e experiência de sistema
- **Objetivo:** janela, tema, idioma, acessibilidade, atalhos e presença no sistema.
- **Entregáveis:**
  - Janela Electron com React, menu nativo, persistência de janela.
  - Temas claro e escuro (F097); idiomas português e inglês com estrutura para outros (F098); acessibilidade WCAG 2.2 AA com teste automático de contraste e foco (F099).
  - Atalhos configuráveis (F086, F096) e paleta de comandos (UI-081).
  - Janela rápida global por atalho do sistema (F114, UI-069).
  - Bandeja do sistema e execução em segundo plano (F115, UI-070).
  - Notificações locais de tarefa concluída (F100).
  - Ajuda e documentação dentro do app (F120).
  - Barra de status personalizável (F085, UI-043 base).
- **Aceite:** trocar idioma e tema persiste; atalho global abre a janela rápida mesmo com o app minimizado; navegação completa por teclado.
- **Tamanho:** G.

### Passo 4 — Armazenamento, configuração em camadas e segurança de base
- **Objetivo:** dados locais, configuração e cofre de credenciais.
- **Entregáveis:**
  - SQLite com migrações versionadas; FTS5.
  - Cofre de chaves e tokens de conectores com o armazenamento seguro do sistema.
  - Configuração em três camadas: usuário, projeto e local (F084).
  - Instruções globais (F044, UI-006).
  - Modo seguro: iniciar sem plugins, hooks, MCP e skills (F087).
  - Tela de dados locais: pasta de armazenamento, exportar tudo, apagar tudo (UI-006, aba dados locais).
- **Aceite:** chaves não aparecem em texto no banco nem em logs; modo seguro inicia sem nenhuma extensão; apagar tudo remove todos os dados locais.
- **Tamanho:** M.

---

## Fase 1 — Modelos (passos 5–8)

### Passo 5 — Camada de provedores e API
- **Objetivo:** uma interface para todos os modelos, com o mesmo conjunto de capacidades da API do Claude.
- **Entregáveis:**
  - Interface `ModelProvider` com streaming por eventos (F101, F102).
  - Adaptadores: Ollama (API nativa), OpenAI-compatível (LM Studio, llama.cpp, vLLM), Anthropic, OpenAI, OpenRouter.
  - Cache de prompt quando o provedor suportar (F105).
  - Processamento em lote com fila e reexecução de falhas (F106).
  - Upload e reuso de arquivos quando o provedor suportar (F110).
- **Aceite:** teste de conversa com streaming e cache passa em todos os adaptadores; lote de 50 requisições conclui com reexecução de falhas.
- **Tamanho:** G.

### Passo 6 — Capacidades, raciocínio e edição de contexto
- **Objetivo:** usar cada modelo conforme o que ele faz.
- **Entregáveis:**
  - Registro de capacidades: contexto, visão, ferramentas, raciocínio (F112).
  - Raciocínio estendido com orçamento (F003).
  - Esforço e modo rápido quando o modelo oferecer (F004).
  - Edição de contexto: remover ou substituir trechos antigos (F111).
- **Aceite:** modelo sem ferramentas entra no fallback do passo 15 sem erro; orçamento de raciocínio muda a resposta e o uso reportado.
- **Tamanho:** M.

### Passo 7 — Gestão de provedores e seleção de modelo
- **Objetivo:** configurar e escolher modelos sem editar arquivos.
- **Entregáveis:**
  - Tela de provedores com URL base, chave e teste de conexão (UI-006, aba provedores).
  - Seletor de modelo com selo local ou nuvem e capacidades (F002, UI-020).
  - Baixar modelo do Ollama com progresso real; remover modelo.
- **Aceite:** baixar um modelo pequeno mostra progresso e aparece na lista; chave inválida gera erro claro.
- **Tamanho:** M.

### Passo 8 — Parâmetros, contagem de tokens e estilos
- **Objetivo:** controle fino da geração e do formato das respostas.
- **Entregáveis:**
  - Temperatura, top-p, máximo de tokens, janela de contexto, prompt de sistema.
  - Contagem exata de tokens por família de modelo (F107) e contador de contexto (UI-025).
  - Estilos de resposta por conversa (F025) e presets globais (F045).
  - Estilos de saída do agente de código (F133, UI-053).
- **Aceite:** contador não passa do limite sem aviso; trocar estilo muda o formato da resposta em teste de referência.
- **Tamanho:** P.

---

## Fase 2 — Chat (passos 9–11)

### Passo 9 — Interface de chat, entrada e voz
- **Objetivo:** experiência de chat completa, com entrada de texto, imagem e voz.
- **Entregáveis:**
  - Lista virtualizada, streaming, parar geração, markdown, LaTeX, código com cópia (F005, F006, F015, UI-002, UI-015 a UI-017, UI-026).
  - Feedback local nas respostas (F014, UI-013), sem envio a terceiros.
  - Colar texto longo como arquivo (F020).
  - Imagens enviadas a modelos com visão (F019, UI-019).
  - Comandos `/` e menções `@` (F023, UI-027).
  - Ferramentas por conversa: busca, skills, MCP, terminal (F024, UI-021).
  - Modo Vim no campo de prompt (F130, UI-028).
  - Ditado por voz com transcrição local (F021, UI-024).
  - Conversa falada com interrupção e indicador de voz (F022, UI-066).
  - Versão mobile do campo de entrada com voz e câmera (UI-073 a UI-076, ajustes).
- **Aceite:** conversa de 500 mensagens rola sem travar; ditado em português transcreve frase de 20 palavras com erro baixo; conversa falada responde e pode ser interrompida.
- **Tamanho:** G+.

### Passo 10 — Conversas, busca e retomada
- **Objetivo:** organizar e reencontrar conversas.
- **Entregáveis:**
  - Criar, renomear, fixar, arquivar, excluir (F010).
  - Busca no histórico com trechos destacados (F011) e busca global por atalho.
  - Retomar sessões anteriores (F078, UI-046).
  - Barra lateral agrupada por data (UI-001).
- **Aceite:** busca encontra palavra em mensagem de três meses atrás em menos de 300 ms com 10 mil mensagens.
- **Tamanho:** M.

### Passo 11 — Ramificação, exportação e compartilhamento local
- **Objetivo:** explorar alternativas e levar conversas para fora do app.
- **Entregáveis:**
  - Editar, regenerar, navegar entre ramificações (F007, F008, F009, UI-014).
  - Exportar em Markdown, JSON e PDF (F012).
  - Compartilhar conversa como arquivo HTML ou link de leitura servido pelo modo web (F013, UI-007).
- **Aceite:** editar cria ramificação e a versão antiga continua acessível; PDF exportado preserva código e tabelas.
- **Tamanho:** M.

---

## Fase 3 — Projetos, arquivos e artifacts (passos 12–14)

### Passo 12 — Projetos
- **Objetivo:** contexto compartilhado por projeto.
- **Entregáveis:** criar projeto (F026, UI-029); instruções do projeto (F027, UI-030); memória de projeto em arquivo (F046, UI-032).
- **Aceite:** instrução do projeto entra só nas conversas dele.
- **Tamanho:** M.

### Passo 13 — Base de conhecimento, recuperação e reuniões
- **Objetivo:** responder com base em arquivos e gravações.
- **Entregáveis:**
  - Ingestão de PDF, DOCX, XLSX, CSV, TXT, código, imagens (OCR) (F018).
  - Base do projeto com indexação e estado (F028, UI-031).
  - Recuperação híbrida: vetor e FTS (F029).
  - Citações com origem e página (F016, F109, UI-011).
  - Gravação e transcrição de reuniões com resumo e ações (F061, UI-067).
- **Aceite:** pergunta sobre PDF de 200 páginas responde com página correta; reunião de 30 minutos gera resumo com tópicos e ações.
- **Tamanho:** G+.

### Passo 14 — Artifacts
- **Objetivo:** produzir e visualizar conteúdo fora do chat.
- **Entregáveis:**
  - Painel lateral (UI-004, UI-033 a UI-037).
  - Tipos: Markdown, código, HTML, React (compilação no navegador com esbuild-wasm ou equivalente), SVG, Mermaid.
  - Alternância código e preview (F033), versões com restauração (F034, UI-036), edição iterativa (F035).
  - Execução isolada com CSP restrita (F036).
  - Artifact que chama o modelo por ponte controlada (F037).
  - Publicar localmente ou como link do modo web (F038).
  - Download e cópia (F039).
  - Relatórios de pesquisa e dados saem como artifacts.
- **Aceite:** HTML que tenta ler arquivos do usuário é bloqueado; artifact que chama o modelo recebe resposta; restauração de versão funciona.
- **Tamanho:** G+.

---

## Fase 4 — Agente e ferramentas (passos 15–18)

### Passo 15 — Loop do agente, CLI e avaliação
- **Objetivo:** o modelo usa ferramentas até concluir a tarefa, em qualquer interface.
- **Entregáveis:**
  - Ciclo chamada, resultado, nova chamada, com limite de passos e cancelamento (F104, UI-039).
  - Ferramentas nativas do provedor e ferramentas próprias (F103).
  - Fallback para modelos sem ferramentas nativas, com saída estruturada validada por Zod (F108).
  - Modo headless `zenith -p` com saída em texto ou JSON (F064).
  - CLI interativa `zenith` no terminal (F063).
  - SDK público do núcleo (F065, packages/sdk).
  - Suíte de avaliação de chamadas de ferramenta com tarefas fixas, para comparar modelos locais.
- **Aceite:** tarefa de três passos conclui; modelo sem ferramentas nativas conclui pelo fallback; `zenith -p` roda em CI sem interface; relatório de avaliação gera tabela por modelo.
- **Tamanho:** G+.

### Passo 16 — Permissões, modos e auditoria local
- **Objetivo:** nada sensível acontece sem consentimento visível e registrado.
- **Entregáveis:**
  - Categorias: ler, escrever, executar, rede, instalar, controlar tela.
  - Modos: padrão (perguntar), aceitar edições, plano (somente leitura, gera plano para aprovação) e sem aprovação (desligado por padrão e com aviso permanente) (F068, F069, UI-022, UI-041, UI-045).
  - Regras persistentes por projeto e por ferramenta.
  - Comandos compostos (`&&`, `|`, redirecionamentos) pedem aprovação do conjunto.
  - Auditoria local de todas as execuções com filtro e exportação. Não é enviada a nenhum servidor.
- **Aceite:** em modo plano nenhuma escrita ocorre; regra salva vale na sessão seguinte; log registra negação e aprovação.
- **Tamanho:** M+.

### Passo 17 — Arquivos, diff, checkpoints e diretórios
- **Objetivo:** o agente altera arquivos com segurança e reversibilidade.
- **Entregáveis:**
  - Ler, listar, buscar (ripgrep), criar, editar por patch, excluir com confirmação (F066, UI-040).
  - Checkpoints antes de cada turno e rewind que restaura arquivos e conversa (F076, UI-018).
  - Diretórios adicionais no contexto (F121).
  - Caminhos com espaços tratados em todas as ferramentas.
- **Aceite:** após sequência de edições, rewind restaura byte a byte; caminho fora das permissões é recusado; caminho `E:\PROJETOS COM IA\...` funciona.
- **Tamanho:** G.

### Passo 18 — Terminal, tarefas em segundo plano e sandbox
- **Objetivo:** terminal real, execução segura e diagnóstico.
- **Entregáveis:**
  - Terminal com abas (PowerShell, cmd, WSL, Git Bash, bash) via node-pty e xterm.js (F067, UI-051).
  - Tarefas em segundo plano com acompanhamento de saída (F132).
  - Colar imagens no terminal (F129).
  - Sandbox: execução em ambiente restrito (WSL ou contêiner quando instalado; restrição nativa de usuário no Windows como alternativa); obrigatória para plugins e comandos de terceiros.
  - Limite de tempo e de saída; encerrar processo.
  - Diagnóstico `/doctor` com verificações e correções (F128, UI-052).
- **Aceite:** `npm run dev` roda, erro de build é lido e corrigido pelo agente; plugin de teste não acessa arquivos fora do projeto; diagnóstico detecta ferramenta ausente.
- **Tamanho:** G+.

---

## Fase 5 — Código e IDE (passos 19–21)

### Passo 19 — Editor, explorador, LSP e IDEs
- **Objetivo:** programar sem sair do app e levar o núcleo para os editores.
- **Entregáveis:**
  - Explorador com `.gitignore`, Monaco com abas, diff com aceitar e rejeitar por trecho (UI-048, UI-040).
  - Navegação por servidor de linguagem: definição, referências, símbolos (F136, UI-054).
  - Extensão do VS Code que conversa com o núcleo (F081).
  - Plugin do JetBrains com o mesmo protocolo (F081).
- **Aceite:** editar pelo editor e pelo agente mostra o mesmo estado; "ir à definição" funciona em TypeScript e Python; extensão do VS Code envia tarefa ao núcleo e recebe o diff.
- **Tamanho:** G+.

### Passo 20 — Git, worktrees e integração com GitHub
- **Objetivo:** controle de versão e tarefas isoladas.
- **Entregáveis:**
  - Status, diff, stage, commit, branch e histórico (F079, UI-049).
  - Worktree por tarefa do agente (F080, UI-050).
  - Pull request via `gh` e menção em PR que dispara o agente em CI (F119).
  - Indicador de ramo na barra de status (UI-043).
- **Aceite:** tarefa roda em worktree separada sem alterar a árvore principal; PR criado com descrição revisável; workflow de exemplo roda `zenith -p` em CI.
- **Tamanho:** M+.

### Passo 21 — Subagentes, equipes de agentes e plano
- **Objetivo:** dividir trabalho grande com contexto limpo e coordenação.
- **Entregáveis:**
  - Subagentes com contexto isolado e ferramentas restritas (F070, UI-047).
  - Subagentes definidos em Markdown com ferramentas e modelo próprios (F134).
  - Gerenciar subagentes pelo comando `/agents` (F124).
  - Equipes de agentes: várias sessões com tarefas compartilhadas e mensagens (F083, UI-061).
  - Lista de tarefas visível e editável (UI-042).
- **Aceite:** subagente lê 50 arquivos e devolve só um resumo; equipe de três agentes conclui tarefas em paralelo sem conflito de arquivos (worktrees).
- **Tamanho:** G.

---

## Fase 6 — Extensibilidade (passos 22–25)

### Passo 22 — Skills e comandos embutidos
- **Objetivo:** capacidades reutilizáveis e comandos do agente de código.
- **Entregáveis:**
  - Carregador de `SKILL.md` (frontmatter `name` e `description`, scripts e recursos) (F053).
  - Carregamento automático pela descrição e invocação por `/nome` (F023).
  - Comandos embutidos: `/init` (F122), `/memory` (F123), `/permissions` (F126).
  - Comandos com argumentos `$ARGUMENTS` (F131).
  - Revisão de código e de segurança como skill embutida (F088).
  - Tela de skills: ativar, desativar, criar, editar, testar (UI-006, aba skills).
- **Aceite:** skill é carregada quando a descrição combina com o pedido; `/review` gera relatório com itens numerados; scripts de skill respeitam o modo de permissão.
- **Tamanho:** M+.

### Passo 23 — Plugins, marketplace, extensões e complementos
- **Objetivo:** pacotes instaláveis, catálogo e extensões de desktop.
- **Entregáveis:**
  - Manifesto `zenith-plugin.json` com skills, comandos, ferramentas, hooks e MCP (F054, F074).
  - Marketplace por índice JSON em repositório Git configurável (F055, UI-071).
  - Verificação estática antes da instalação: padrões perigosos, permissões pedidas (F056).
  - Extensões de desktop com um clique para servidores MCP (F116).
  - Complemento para Office (planilhas e apresentações) que envia seleção ao núcleo (F117).
- **Aceite:** plugin de exemplo instala, adiciona comando e ferramenta, e remove sem resíduos; plugin com comando suspeito é sinalizado antes da instalação; complemento do Office envia seleção e recebe resposta.
- **Tamanho:** G+.

### Passo 24 — Hooks de ciclo de vida
- **Objetivo:** automação e controle em eventos do agente.
- **Entregáveis:**
  - Eventos: início de sessão, envio de prompt, antes e depois de ferramenta, notificação, fim (F072).
  - Hooks de comando ou função, de todas as fontes (usuário, projeto, plugin), com log (F125, UI-062).
  - Hook de notificação que avisa quando o agente precisa de atenção (F135).
- **Aceite:** hook `PreToolUse` que bloqueia comando perigoso impede a execução e informa o modelo; log mostra cada disparo.
- **Tamanho:** M.

### Passo 25 — MCP e conectores
- **Objetivo:** ferramentas externas padronizadas, inclusive serviços de consumo com credenciais locais.
- **Entregáveis:**
  - Cliente MCP com stdio, HTTP streamable e SSE (F051, F073).
  - Descoberta de ferramentas, recursos e prompts; schema completo carregado sob demanda.
  - Recursos e prompts MCP como comandos (F131).
  - Conectores de apps (Drive, Gmail, Calendar, Slack, GitHub) como servidores MCP com credenciais locais (F050).
  - Tela de servidores com estado, log e ferramentas (F127, UI-063).
- **Aceite:** servidor de arquivos de teste expõe ferramentas usadas pelo agente; servidor que cai aparece como erro sem travar o app; conector de exemplo usa credencial local e nunca a envia a terceiros.
- **Tamanho:** G.

---

## Fase 7 — Web, pesquisa e dados (passos 26–27)

### Passo 26 — Pesquisa, citações e sessão proativa
- **Objetivo:** pesquisar, citar e acompanhar temas.
- **Entregáveis:**
  - Busca web com provedor configurável (API ou SearXNG local) e leitura de páginas (F047, F113).
  - Pesquisa profunda em várias etapas com plano, fontes em tempo real e relatório em artifact (F048, UI-064).
  - Sessão proativa que acompanha um tema e propõe atualizações (F062, UI-065).
  - Conteúdo de página tratado sempre como dado; nunca como instrução.
- **Aceite:** pergunta atual retorna resposta com duas ou mais fontes; página com instrução maliciosa não altera o comportamento; sessão proativa gera atualização com data.
- **Tamanho:** G.

### Passo 27 — Preview e análise de dados
- **Objetivo:** rodar aplicações e analisar dados.
- **Entregáveis:**
  - Preview com URL local e console (UI-048 e painel de preview).
  - Análise de dados em sandbox: Python com tabelas e gráficos gerados como artifact (F049, UI-068).
- **Aceite:** servidor local iniciado pelo terminal aparece no preview; planilha de 10 mil linhas gera gráfico correto.
- **Removido do plano (a pedido):** gerador de projetos fullstack a partir de templates (React + Express, Next.js, FastAPI, monorepo com Docker Compose).
- **Tamanho:** G+.

---

## Fase 8 — Memória, automação e plataformas (passos 28–30)

### Passo 28 — Memória e contexto
- **Objetivo:** lembrar do usuário e manter conversas longas.
- **Entregáveis:**
  - Memória global em arquivo Markdown e por projeto (F040, F046, F075, UI-032).
  - Usar conversas antigas como fonte de contexto (F041).
  - Ver, editar, apagar e pausar memória (F042).
  - Importar memória de exportação de outro assistente, em texto ou JSON (F043).
  - Compactação automática e comando `/compact` (F077).
- **Aceite:** fato dito numa conversa é lembrado em outra e pode ser apagado; conversa de 200 turnos continua coerente após compactação.
- **Tamanho:** M+.

### Passo 29 — Automação: agendamento, Cowork, controle de tela e navegador
- **Objetivo:** o agente age fora da conversa, com permissão explícita.
- **Entregáveis:**
  - Agendamento de tarefas recorrentes ou pontuais, com painel e histórico (F058, UI-058).
  - Cowork: agente sobre pastas escolhidas, com painel de tarefa e lista de arquivos alterados (F057, UI-055, UI-056).
  - Controle de computador: captura de tela, mouse e teclado com aprovação por aplicativo, indicador de ação e botão de parar (F059, UI-057, UI-059). Inicialmente em Windows.
  - Extensão de navegador (Chromium) que liga o navegador ao núcleo, com permissão por site (F060, UI-060).
  - Revisão de segurança específica para automação de tela e navegador.
- **Aceite:** tarefa agendada roda no horário e registra resultado; Cowork não altera arquivo fora das pastas concedidas; controle de tela pede aprovação antes da primeira ação; extensão só age nos sites autorizados.
- **Tamanho:** G++ (maior risco do plano).

### Passo 30 — Modo web, mobile, release e documentação
- **Objetivo:** levar o Zenith a todas as plataformas do escopo e entregar o 1.0.
- **Entregáveis:**
  - Modo web: o mesmo núcleo servido em rede local, acessado por navegador com pareamento de uso único, sem conta (F082, UI-072).
  - Sessões que continuam rodando em segundo plano e podem ser retomadas de outro dispositivo da rede local.
  - PWA para celular com ajustes de toque (F089, UI-073 a UI-076).
  - Instaladores: Windows (NSIS e MSIX), macOS (DMG) e Linux (AppImage); atualização automática; assinatura quando houver certificado.
  - Primeiro uso: escolher local ou nuvem, baixar modelo conforme RAM e VRAM, criar primeiro projeto (UI-077 e onboarding).
  - Revisão final de segurança, testes E2E de todas as fases e documentação do usuário e do desenvolvedor.
  - Guia de criação de plugins, skills e hooks.
- **Aceite:** instalação limpa em Windows 11 sem Node instalado; primeiro uso leva a uma conversa respondida por modelo local em menos de 10 minutos; pareamento de celular na mesma rede funciona sem conta; E2E verde nos três sistemas.
- **Tamanho:** G++.

---

## Resumo das fases

| Fase | Passos | Resultado ao final da fase |
|---|---|---|
| 0 Fundação | 1–4 | App com janela, tema, idioma, dados locais e cofre |
| 1 Modelos | 5–8 | Modelos locais e de nuvem com API completa |
| 2 Chat | 9–11 | Chat completo com voz, histórico, ramificação e exportação |
| 3 Projetos e artifacts | 12–14 | Projetos, base de conhecimento, reuniões e artifacts |
| 4 Agente | 15–18 | Agente com permissões, arquivos, terminal e sandbox |
| 5 Código e IDE | 19–21 | Editor, LSP, git, extensões de IDE e subagentes |
| 6 Extensibilidade | 22–25 | Skills, plugins, marketplace, hooks, MCP e conectores |
| 7 Pesquisa e dados | 26–27 | Pesquisa com fontes, sessões proativas e análise de dados |
| 8 Memória, automação e plataformas | 28–30 | Memória, agendamento, Cowork, controle de tela, web, mobile e release |

## Cobertura por passo (IDs de função)

| Passo | Funções |
|---|---|
| 1 | — (matriz) |
| 2 | — (base) |
| 3 | F085, F086, F096, F097, F098, F099, F100, F114, F115, F120 |
| 4 | F044, F084, F087 |
| 5 | F101, F102, F105, F106, F110 |
| 6 | F003, F004, F111, F112 |
| 7 | F002 |
| 8 | F025, F045, F107, F133 |
| 9 | F001, F005, F006, F014, F015, F019, F020, F021, F022, F023, F024, F130 |
| 10 | F010, F011, F078 |
| 11 | F007, F008, F009, F012, F013 |
| 12 | F026, F027, F046 |
| 13 | F016, F018, F028, F029, F061, F109 |
| 14 | F031, F032, F033, F034, F035, F036, F037, F038, F039 |
| 15 | F063, F064, F065, F103, F104, F108 |
| 16 | F068, F069 |
| 17 | F066, F076, F121 |
| 18 | F067, F128, F129, F132 |
| 19 | F081, F136 |
| 20 | F079, F080, F119 |
| 21 | F070, F083, F124, F134 |
| 22 | F053, F071, F088, F122, F123, F126, F131 |
| 23 | F054, F055, F056, F074, F116, F117 |
| 24 | F072, F125, F135 |
| 25 | F050, F051, F073, F127 |
| 26 | F047, F048, F062, F113 |
| 27 | F049 |
| 28 | F040, F041, F042, F043, F075, F077 |
| 29 | F057, F058, F059, F060 |
| 30 | F082, F089 |

Todas as 126 funções ativas do documento 01 aparecem exatamente uma vez nesta tabela.

## Pós-1.0

- Geração de imagem e vídeo como plugins.
- Controle de computador em macOS e Linux, com as mesmas permissões.
- Cliente móvel nativo (fora do PWA).
- Sincronização entre dispositivos pela rede local (sem nuvem própria).
