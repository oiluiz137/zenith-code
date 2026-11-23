# 01 — Inventário de funções do Claude (escopo revisado)

Referência para o projeto **Zenith**. Lista as funções do ecossistema Claude (app web/desktop/mobile, Claude Code e a plataforma de API) que o Zenith precisa igualar em **capacidade**. Os IDs (`F001`…) são estáveis e usados nos documentos 02, 03 e 04.

**Revisão de escopo (novembro de 2026):** removidos todos os itens de **conta, login, equipes, administração, planos/limites por conta, sincronização entre contas e uso de dados para treinamento ou monitoramento do usuário**. Os IDs removidos continuam listados no fim, na seção "Removidos do escopo", para rastreabilidade. Itens acrescentados nesta revisão (Claude Code e desktop) estão nas seções J e K.

Itens marcados **(verificar)** vieram de fontes secundárias ou de memória. Devem ser confirmados nas notas oficiais (`support.claude.com`) e na documentação do Claude Code (`code.claude.com/docs`) antes do início do passo correspondente.

---

## A. Conversa e modelos (16)

| ID | Função | Descrição |
|---|---|---|
| F001 | Chat multi-turno | Conversas com histórico persistente e contexto acumulado |
| F002 | Seleção de modelo | Trocar de modelo por conversa |
| F003 | Raciocínio estendido | Modelo raciocina antes de responder, com orçamento de tokens |
| F004 | Esforço e velocidade | Controle de quanto raciocinar e modo rápido, quando o modelo oferecer |
| F005 | Streaming | Texto aparece em tempo real |
| F006 | Interromper geração | Parar a resposta no meio |
| F007 | Regenerar resposta | Pedir nova versão da última resposta |
| F008 | Editar mensagem enviada | Corrigir um prompt e reenviar |
| F009 | Navegar ramificações | Alternar entre versões de respostas e edições |
| F010 | Gerir conversas | Renomear, fixar, arquivar, excluir |
| F011 | Buscar no histórico | Busca em conversas e mensagens |
| F012 | Exportar conversa | Markdown, JSON e PDF |
| F013 | Compartilhar conversa | Gerar link de leitura ou arquivo HTML da conversa, sem conta |
| F014 | Feedback nas respostas | Polegar para cima/baixo, guardado apenas localmente |
| F015 | Renderização rica | Markdown, tabelas, LaTeX, código com cópia e realce |
| F016 | Citações | Fontes numeradas quando a resposta usa web ou documentos |

## B. Entrada e anexos (8)

| ID | Função | Descrição |
|---|---|---|
| F018 | Anexar arquivos | PDF, DOCX, XLSX, CSV, TXT, código e outros |
| F019 | Análise de imagens | Enviar imagens a modelos com visão e perguntar sobre elas |
| F020 | Colar texto longo como arquivo | Conteúdo grande vira anexo automaticamente |
| F021 | Ditado por voz | Transcrever fala para o campo de texto |
| F022 | Modo de voz | Conversa falada com resposta em áudio |
| F023 | Comandos `/` e menções `@` | Acionar comandos, skills, arquivos e servidores no composer |
| F024 | Ferramentas por conversa | Ligar e desligar busca, skills, MCP e terminal em cada conversa |
| F025 | Estilo de resposta por conversa | Escolher tom e formato para a conversa |

## C. Projetos (4)

| ID | Função | Descrição |
|---|---|---|
| F026 | Projetos | Agrupar conversas e arquivos sob um contexto |
| F027 | Instruções do projeto | Prompt de sistema próprio do projeto |
| F028 | Base de conhecimento | Arquivos disponíveis em todas as conversas do projeto |
| F029 | Recuperação em bases grandes | Buscar só os trechos relevantes quando a base não cabe no contexto |

## D. Artifacts (9)

| ID | Função | Descrição |
|---|---|---|
| F031 | Criar artifacts | Documentos, código, HTML/React, SVG e diagramas em painel próprio |
| F032 | Pré-visualização | Resultado renderizado ao lado do chat |
| F033 | Alternar código e preview | Abas para fonte e resultado |
| F034 | Versionamento | Histórico de versões com restauração |
| F035 | Edição iterativa | Alterações pontuais sem reescrever tudo |
| F036 | Execução isolada | HTML e React rodam em sandbox |
| F037 | Artifact que chama IA | Aplicativo que usa o modelo a partir do próprio artifact (verificar) |
| F038 | Publicar artifact | Gerar link de leitura local ou página estática (verificar) |
| F039 | Download e cópia | Baixar arquivo ou copiar conteúdo |

## E. Memória e personalização (7)

| ID | Função | Descrição |
|---|---|---|
| F040 | Memória entre conversas | Lembrar fatos e preferências do usuário |
| F041 | Memória do histórico | Usar conversas antigas como fonte de contexto |
| F042 | Gerir memória | Ver, editar, apagar e pausar a memória |
| F043 | Importar memória de outro assistente | Trazer contexto a partir de exportação em texto ou JSON |
| F044 | Instruções globais | Instruções personalizadas para todas as conversas |
| F045 | Estilos de resposta | Presets de tom e formato |
| F046 | Memória de projeto | Notas persistentes de um projeto |

## F. Ferramentas, pesquisa e integrações (15)

| ID | Função | Descrição |
|---|---|---|
| F047 | Pesquisa na web | Buscar e ler páginas durante a resposta |
| F048 | Pesquisa profunda | Investigação em várias etapas com relatório e fontes |
| F049 | Análise de dados em sandbox | Executar código para analisar planilhas e gerar gráficos |
| F050 | Conectores de apps | Integrações com Drive, Gmail, Calendar, Slack, GitHub e similares, via servidores MCP com credenciais configuradas localmente |
| F051 | Conectores MCP customizados | Servidores MCP locais ou remotos |
| F053 | Skills | Pastas com `SKILL.md`, scripts e recursos, invocadas por nome ou carregadas quando relevantes |
| F054 | Plugins | Pacotes com skills, hooks, subagentes e servidores MCP |
| F055 | Marketplace de plugins | Catálogo para descobrir e instalar plugins |
| F056 | Verificação de skills e plugins | Análise estática antes da instalação (verificar) |
| F057 | Cowork | Agente de desktop que trabalha sobre pastas escolhidas, com painel de tarefa |
| F058 | Agendamento de tarefas | Tarefas recorrentes ou pontuais |
| F059 | Controle de computador | Ver a tela e operar aplicativos por mouse e teclado, com aprovação |
| F060 | Extensão de navegador | Agir em páginas do navegador do usuário |
| F061 | Gravação e resumo de reuniões | Transcrever e resumir reuniões gravadas (verificar) |
| F062 | Pesquisa proativa | Sessão de pesquisa que acompanha um tema e propõe atualizações (verificar) |

## G. Claude Code — núcleo (26)

| ID | Função | Descrição |
|---|---|---|
| F063 | Sessão interativa no terminal | REPL do agente dentro do terminal |
| F064 | Modo não interativo | Um prompt, saída em texto ou JSON, para scripts e CI |
| F065 | SDK de agente | Usar o mesmo núcleo como biblioteca |
| F066 | Ler e editar arquivos | Leitura, criação e alteração com diff |
| F067 | Executar comandos | Shell com aprovação |
| F068 | Modos de permissão | Padrão, aceitar edições, plano e sem aprovação |
| F069 | Modo plano | Planejar e aprovar antes de editar |
| F070 | Subagentes | Agentes com contexto isolado e ferramentas restritas |
| F071 | Comandos de barra | Comandos embutidos e personalizados |
| F072 | Hooks de ciclo de vida | Scripts em eventos do agente |
| F073 | Servidores MCP no agente | Ferramentas externas disponíveis ao agente |
| F074 | Plugins e marketplaces do agente | Instalar pacotes de comandos, hooks, subagentes e MCP |
| F075 | Memória de projeto e de usuário | Arquivos de instrução lidos automaticamente (equivalente ao CLAUDE.md) |
| F076 | Checkpoints e rewind | Voltar código e conversa a um ponto anterior (verificar nomes atuais) |
| F077 | Compactação de contexto | Resumir a conversa quando o contexto enche |
| F078 | Retomar sessões | Continuar uma sessão anterior |
| F079 | Integração git | Status, diff, commit, branch, PR via `gh` |
| F080 | Worktrees | Tarefas em cópias isoladas do repositório |
| F081 | Integração com IDE | Extensões para VS Code e JetBrains |
| F082 | Sessões remotas | Rodar sessões em outro computador ou na rede local, acessadas por navegador |
| F083 | Equipes de agentes | Várias sessões coordenadas com tarefas e mensagens (verificar) |
| F084 | Configuração em camadas | Ajustes de usuário, projeto e local |
| F085 | Barra de status personalizável | Informações configuráveis na barra |
| F086 | Atalhos personalizáveis | Teclas editáveis |
| F087 | Modo seguro | Iniciar sem plugins, hooks, MCP e skills (verificar) |
| F088 | Revisão de código | Comando de revisão, inclusive de segurança |

## H. Plataforma de uso e interface (6)

| ID | Função | Descrição |
|---|---|---|
| F089 | Multiplataforma | Desktop Windows, macOS e Linux, web e mobile |
| F096 | Atalhos de teclado | Atalhos globais e de navegação |
| F097 | Temas claro e escuro | Aparência adaptável |
| F098 | Idiomas | Interface em português e inglês, com outros idiomas possíveis |
| F099 | Acessibilidade | Teclado, leitor de tela e contraste |
| F100 | Notificações | Aviso de resposta ou tarefa concluída |

## I. API e base técnica (13)

| ID | Função | Descrição |
|---|---|---|
| F101 | Messages API | Conversa estruturada por mensagens |
| F102 | Streaming por eventos | Eventos incrementais de texto, ferramenta e raciocínio |
| F103 | Tool use | Modelo pede execução de ferramentas definidas pelo cliente |
| F104 | Loop de ferramentas | Ciclo chamada, resultado e nova chamada |
| F105 | Cache de prompt | Reuso de prefixos para reduzir custo e latência |
| F106 | Processamento em lote | Fila assíncrona de muitas requisições |
| F107 | Contagem de tokens | Estimativa antes do envio |
| F108 | Saída estruturada | Resposta em JSON ou esquema |
| F109 | Citações de documentos | Trechos de origem nas respostas |
| F110 | API de arquivos | Upload reutilizável entre requisições |
| F111 | Edição de contexto | Remover ou substituir partes antigas do contexto |
| F112 | Gestão de modelos | Listar modelos e capacidades; migrar entre versões |
| F113 | Ferramentas nativas equivalentes | Busca web e execução de código (no Zenith, implementadas localmente) |

## J. Desktop e integrações locais (6)

| ID | Função | Descrição |
|---|---|---|
| F114 | Janela rápida global | Atalho de sistema para perguntar sem abrir o app (verificar) |
| F115 | Bandeja e segundo plano | Ícone na bandeja e execução contínua |
| F116 | Extensões de desktop | Instalar pacotes de servidores MCP com um clique (verificar) |
| F117 | Complemento para Office | Painel nas planilhas e apresentações (verificar) |
| F119 | Integração com GitHub | Menção em PR e execução do agente em CI (verificar) |
| F120 | Ajuda no app | Documentação e exemplos dentro do app |

## K. Claude Code — comandos e recursos adicionais (16)

| ID | Função | Descrição |
|---|---|---|
| F121 | Diretórios adicionais | Incluir outras pastas no contexto (`/add-dir`) |
| F122 | Inicialização de projeto | Gerar arquivo de instruções do projeto (`/init`) |
| F123 | Gerir memória | Editar a memória pelo comando (`/memory`) |
| F124 | Gerir subagentes | Criar e editar subagentes (`/agents`) |
| F125 | Gerir hooks | Ver e editar hooks (`/hooks`) |
| F126 | Gerir permissões | Ver e ajustar regras (`/permissions`) |
| F127 | Gerir servidores MCP | Ver e ajustar servidores (`/mcp`) |
| F128 | Diagnóstico do ambiente | Verificar instalação e configuração (`/doctor`) |
| F129 | Colar imagens no terminal | Enviar imagem da área de transferência |
| F130 | Modo de edição estilo Vim | Atalhos Vim no campo de prompt |
| F131 | Comandos com argumentos | `$ARGUMENTS` e recursos MCP expostos como comandos |
| F132 | Tarefas em segundo plano | Comandos longos rodando em paralelo, com acompanhamento de saída |
| F133 | Estilos de saída | Presets de formato para o agente de código |
| F134 | Subagentes em Markdown | Definir subagente com ferramentas e modelo próprios |
| F135 | Hook de notificação | Disparar aviso quando o agente precisa de atenção |
| F136 | Navegação de código por LSP | Ir à definição, referências e símbolos via servidor de linguagem |

---

## Totais (escopo revisado)

| Grupo | Itens |
|---|---|
| A a I (inventário original, sem removidos) | 104 |
| J e K (acrescentados) | 22 |
| **Total ativo** | **126** |

Removidos: 9 itens do inventário original mais F118 (acrescentado e removido na mesma revisão). Ver a seção seguinte.

---

## Removidos do escopo

Motivo: conta, login, equipes, administração, planos por conta, sincronização entre contas e uso de dados para treinamento ou monitoramento.

| ID | Função original | Motivo |
|---|---|---|
| F017 | Indicador de uso e limites da conta | Depende de conta e de limites de plano |
| F030 | Compartilhar projeto com equipe | Depende de conta e de membros |
| F052 | Conectores pessoais de consumo | Login em contas de terceiros; coberto por F050 com credenciais locais |
| F090 | Sincronização entre dispositivos | Exige conta na nuvem |
| F091 | Planos e limites | Modelo de cobrança da conta |
| F092 | Equipes e administração | Conta corporativa |
| F093 | SSO e controles empresariais | Login corporativo |
| F094 | API de conformidade | Monitoramento corporativo |
| F095 | Controle de privacidade (treinamento e exclusão de dados) | Opção ligada ao uso de dados para treinamento |
| F118 | Integração com Slack (bot) | Exige cadastro de app e conta no Slack |

## Observações de escopo

- **Autenticação:** o Zenith não tem tela de login nem conta. O pareamento do modo web (F082) usa código local de uso único, sem conta.
- **Dados:** nada é enviado a servidores do Zenith. O app não coleta telemetria. Chamadas de rede vão apenas aos provedores e serviços que o usuário configurar.
- **Credenciais:** chaves de API e tokens de conectores ficam no cofre local do sistema (passo 4).
- **Geração de imagem e vídeo:** o Claude não as oferece nativamente; ficam como plugins possíveis, fora desta lista.
