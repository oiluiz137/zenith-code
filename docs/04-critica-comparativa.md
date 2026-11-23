# 04 — Crítica e mapeamento de paridade (escopo revisado)

Análise do plano revisado (doc 03) contra as 126 funções ativas do inventário (doc 01). Mostra, função por função, em qual passo ela é entregue e com que nível de paridade. Também registra o que **não** foi possível igualar e os riscos que o plano ainda carrega.

---

## 1. Resultado

| Métrica | Valor |
|---|---|
| Funções ativas | 126 |
| Com passo e critério de aceite (planejadas) | 126 (100%) |
| **Paridade completa planejada (C)** | **121 (96,0%)** |
| Paridade parcial, com limitação declarada (P) | 5 (4,0%) |
| Não planejadas (X) | 0 |

**Meta de 95%: atingida no plano (96,0% com paridade completa).** Essa cifra mede **planejamento**, não resultado. A paridade de **qualidade** (quão bem o agente faz as tarefas em comparação com o Claude) não é garantida e só se mede com a suíte de avaliação (passo 15) e com tarefas de referência (seção 4).

Critério usado:
- **C:** a função tem entregável, critério de aceite e passo, sem limitação de plataforma ou de tecnologia declarada.
- **P:** a função é entregue, mas com limitação declarada (seção 3).

---

## 2. Mapeamento função por função

Legenda: **Passo** é o passo do doc 03 que entrega a função. **Nível** é C ou P.

### A. Conversa e modelos

| ID | Função | Passo | Nível |
|---|---|---|---|
| F001 | Chat multi-turno | 9 | C |
| F002 | Seleção de modelo | 7 | C |
| F003 | Raciocínio estendido | 6 | C |
| F004 | Esforço e velocidade | 6 | C |
| F005 | Streaming | 9 | C |
| F006 | Interromper geração | 9 | C |
| F007 | Regenerar resposta | 11 | C |
| F008 | Editar mensagem | 11 | C |
| F009 | Navegar ramificações | 11 | C |
| F010 | Gerir conversas | 10 | C |
| F011 | Buscar no histórico | 10 | C |
| F012 | Exportar conversa (MD, JSON, PDF) | 11 | C |
| F013 | Compartilhar conversa (HTML ou link local) | 11 | C |
| F014 | Feedback local | 9 | C |
| F015 | Renderização rica | 9 | C |
| F016 | Citações | 13 | C |

### B. Entrada e anexos

| ID | Função | Passo | Nível |
|---|---|---|---|
| F018 | Anexar arquivos | 13 | C |
| F019 | Análise de imagens | 9 | C |
| F020 | Colar texto longo como arquivo | 9 | C |
| F021 | Ditado por voz | 9 | C |
| F022 | Modo de voz | 9 | C |
| F023 | Comandos `/` e menções `@` | 9 | C |
| F024 | Ferramentas por conversa | 9 | C |
| F025 | Estilo de resposta por conversa | 8 | C |

### C. Projetos

| ID | Função | Passo | Nível |
|---|---|---|---|
| F026 | Projetos | 12 | C |
| F027 | Instruções do projeto | 12 | C |
| F028 | Base de conhecimento | 13 | C |
| F029 | Recuperação em bases grandes | 13 | C |

### D. Artifacts

| ID | Função | Passo | Nível |
|---|---|---|---|
| F031 | Criar artifacts | 14 | C |
| F032 | Pré-visualização | 14 | C |
| F033 | Alternar código e preview | 14 | C |
| F034 | Versionamento | 14 | C |
| F035 | Edição iterativa | 14 | C |
| F036 | Execução isolada | 14 | C |
| F037 | Artifact que chama IA | 14 | C |
| F038 | Publicar artifact | 14 | C |
| F039 | Download e cópia | 14 | C |

### E. Memória e personalização

| ID | Função | Passo | Nível |
|---|---|---|---|
| F040 | Memória entre conversas | 28 | C |
| F041 | Memória do histórico | 28 | C |
| F042 | Gerir memória | 28 | C |
| F043 | Importar memória de outro assistente | 28 | C |
| F044 | Instruções globais | 4 | C |
| F045 | Estilos de resposta (presets) | 8 | C |
| F046 | Memória de projeto | 12 | C |

### F. Ferramentas, pesquisa e integrações

| ID | Função | Passo | Nível |
|---|---|---|---|
| F047 | Pesquisa na web | 26 | C |
| F048 | Pesquisa profunda | 26 | C |
| F049 | Análise de dados em sandbox | 27 | C |
| F050 | Conectores de apps (via MCP, credenciais locais) | 25 | C |
| F051 | Conectores MCP customizados | 25 | C |
| F053 | Skills | 22 | C |
| F054 | Plugins | 23 | C |
| F055 | Marketplace de plugins | 23 | C |
| F056 | Verificação estática de plugins e skills | 23 | C |
| F057 | Cowork | 29 | C |
| F058 | Agendamento de tarefas | 29 | C |
| F059 | Controle de computador | 29 | **P** |
| F060 | Extensão de navegador | 29 | **P** |
| F061 | Gravação e resumo de reuniões | 13 | C |
| F062 | Pesquisa proativa | 26 | C |

### G. Claude Code — núcleo

| ID | Função | Passo | Nível |
|---|---|---|---|
| F063 | Sessão interativa no terminal | 15 | C |
| F064 | Modo não interativo | 15 | C |
| F065 | SDK de agente | 15 | C |
| F066 | Ler e editar arquivos | 17 | C |
| F067 | Executar comandos | 18 | C |
| F068 | Modos de permissão | 16 | C |
| F069 | Modo plano | 16 | C |
| F070 | Subagentes | 21 | C |
| F071 | Comandos de barra | 22 | C |
| F072 | Hooks de ciclo de vida | 24 | C |
| F073 | Servidores MCP no agente | 25 | C |
| F074 | Plugins e marketplaces do agente | 23 | C |
| F075 | Memória de projeto e de usuário | 28 | C |
| F076 | Checkpoints e rewind | 17 | C |
| F077 | Compactação de contexto | 28 | C |
| F078 | Retomar sessões | 10 | C |
| F079 | Integração git | 20 | C |
| F080 | Worktrees | 20 | C |
| F081 | Integração com IDE (VS Code e JetBrains) | 19 | C |
| F082 | Sessões remotas | 30 | C |
| F083 | Equipes de agentes | 21 | C |
| F084 | Configuração em camadas | 4 | C |
| F085 | Barra de status personalizável | 3 | C |
| F086 | Atalhos personalizáveis | 3 | C |
| F087 | Modo seguro | 4 | C |
| F088 | Revisão de código | 22 | C |

### H. Plataforma de uso e interface

| ID | Função | Passo | Nível |
|---|---|---|---|
| F089 | Multiplataforma (desktop, web, mobile) | 30 | **P** |
| F096 | Atalhos de teclado | 3 | C |
| F097 | Temas claro e escuro | 3 | C |
| F098 | Idiomas | 3 | C |
| F099 | Acessibilidade | 3 | C |
| F100 | Notificações | 3 | C |

### I. API e base técnica

| ID | Função | Passo | Nível |
|---|---|---|---|
| F101 | Messages API | 5 | C |
| F102 | Streaming por eventos | 5 | C |
| F103 | Tool use | 15 | C |
| F104 | Loop de ferramentas | 15 | C |
| F105 | Cache de prompt | 5 | C |
| F106 | Processamento em lote | 5 | C |
| F107 | Contagem de tokens | 8 | C |
| F108 | Saída estruturada | 15 | C |
| F109 | Citações de documentos | 13 | C |
| F110 | API de arquivos | 5 | C |
| F111 | Edição de contexto | 6 | C |
| F112 | Gestão de modelos | 6 | C |
| F113 | Busca web e execução de código nativas | 26 | C |

### J. Desktop e integrações locais

| ID | Função | Passo | Nível |
|---|---|---|---|
| F114 | Janela rápida global | 3 | C |
| F115 | Bandeja e segundo plano | 3 | C |
| F116 | Extensões de desktop (MCP com um clique) | 23 | C |
| F117 | Complemento para Office | 23 | **P** |
| F119 | Integração com GitHub (PR e CI) | 20 | C |
| F120 | Ajuda no app | 3 | C |

### K. Claude Code — comandos e recursos adicionais

| ID | Função | Passo | Nível |
|---|---|---|---|
| F121 | Diretórios adicionais | 17 | C |
| F122 | Inicialização de projeto (`/init`) | 22 | C |
| F123 | Gerir memória (`/memory`) | 22 | C |
| F124 | Gerir subagentes (`/agents`) | 21 | C |
| F125 | Gerir hooks (`/hooks`) | 24 | C |
| F126 | Gerir permissões (`/permissions`) | 22 | C |
| F127 | Gerir MCP (`/mcp`) | 25 | C |
| F128 | Diagnóstico (`/doctor`) | 18 | C |
| F129 | Colar imagens no terminal | 18 | C |
| F130 | Modo Vim | 9 | C |
| F131 | Comandos com argumentos e recursos MCP | 22 | C |
| F132 | Tarefas em segundo plano | 18 | C |
| F133 | Estilos de saída | 8 | C |
| F134 | Subagentes em Markdown | 21 | C |
| F135 | Hook de notificação | 24 | C |
| F136 | Navegação de código por LSP | 19 | **P** |

---

## 3. Limitações assumidas (itens P)

| ID | Limitação | Por que não é paridade completa na 1.0 |
|---|---|---|
| F059 | Controle de computador **só no Windows** | Captura e entrada de tela dependem de API por sistema; macOS e Linux ficam no pós-1.0 |
| F060 | Extensão **só para navegadores Chromium** | Firefox e Safari exigem extensões próprias |
| F089 | Mobile **só como PWA** | Sem recursos nativos (câmera e voz com limitações do navegador, sem notificações em segundo plano) |
| F117 | Complemento do Office **para desktop** | Versão web do Office e o Office de Mac exigem manifesto e testes próprios |
| F136 | LSP **só para linguagens com servidor disponível** | Cada linguagem precisa de servidor instalado; a lista inicial cobre TypeScript, Python e as principais |

Esses cinco itens entram como P de propósito. Não houve arredondamento para cima.

---

## 4. Crítica por eixo

### 4.1 Escopo e prazo
- Dos 30 passos, **10 são G+ ou G++** (passos 9, 13, 14, 15, 18, 19, 23, 27, 29 e 30). Cada um equivale a um projeto de semanas ou meses para uma pessoa.
- Estimativa de ordem de grandeza: para uma pessoa em tempo parcial, o plano completo leva **anos**. Com uma equipe pequena e dedicada, **um a dois anos** é uma estimativa mais realista. Essa estimativa não está verificada e depende de produtividade, de stack e de número de pessoas.
- **Recomendação:** antes de iniciar, escolher um **marco de uso diário** (proposta: fim do passo 18, com agente, terminal e permissões). Dos passos 19 a 30, entregar em ondas, com uso real a cada onda.

### 4.2 Dependências entre passos
- **Passo 9 (voz)** depende do passo 5 (provedores) e de um modelo de transcrição local. Se o ditado não funcionar em português com qualidade, o passo 9 trava. Testar a transcrição antes de começar o passo.
- **Passo 13 (reuniões)** depende da voz do passo 9 e de armazenamento de áudio (passo 4). Só começar depois do passo 9 estar estável.
- **Passo 19 (LSP e IDEs)** depende do terminal (18) e do núcleo exposto como SDK (15). Se o SDK mudar, extensões quebram. Congelar a API do SDK no passo 15.
- **Passo 23 (Office e extensões)** depende de plugins (23), marketplace e verificação. O complemento do Office precisa de distribuição (ver 4.4).
- **Passo 29 (automação de tela e navegador)** depende de sandbox (18), permissões (16) e auditoria (16). É o passo com maior risco de segurança do plano; não começar antes de o passo 16 estar testado com comandos compostos.
- **Passo 30 (web e mobile)** depende de o núcleo já rodar como servidor. Recomendo tratar o núcleo como servidor desde o passo 15, para que o modo web não exija refatoração no fim.

### 4.3 Segurança
- O plano tem **três superfícies de risco** ao mesmo tempo: execução de comandos (18), controle de tela (29) e navegador (29). Cada uma pode ser usada por uma página ou arquivo que injeta instruções.
- Mitigações previstas: permissão por padrão negativo (16), sandbox obrigatória para terceiros (18), conteúdo de página tratado como dado (26), auditoria local (16), pareamento de uso único no modo web (30).
- **Lacuna:** não há plano de **revisão externa** de segurança antes do 1.0. Recomendo contratar uma auditoria ou, no mínimo, um teste de penetração com injeção de prompt antes do passo 30.

### 4.4 Distribuição sem conta
- Zenith não tem conta de usuário, mas **distribuir** extensões tem custo de conta do desenvolvedor: Chrome Web Store, Microsoft Store (ou assinatura de código para MSIX), Visual Studio Marketplace, JetBrains Marketplace, Microsoft AppSource para o complemento do Office.
- **Decisão necessária:** aceitar instalação manual (arquivo ou link) para todas as extensões na 1.0, ou publicar nas lojas. Esta decisão muda o passo 30 e o custo.

### 4.5 Modelos locais
- Chamadas de ferramenta confiáveis só em modelos específicos. O fallback do passo 15 reduz falhas, mas não elimina.
- A suíte de avaliação está no passo 15, ou seja, cedo o bastante. Ainda assim, o plano não define **limiar de aceitação** para um modelo ser recomendado. Definir no passo 15: por exemplo, taxa mínima de acerto em chamadas de ferramenta por tarefa de referência.
- Modelos de visão, voz e transcrição locais variam muito em qualidade; a escolha padrão precisa ser testada em português.

### 4.6 Windows
- node-pty exige Visual Studio Build Tools quando não há binário pronto. Isso precisa estar no passo 2.
- Caminhos com espaços, como `E:\PROJETOS COM IA\...`, precisam de teste explícito nos passos 17 e 18.
- Controle de tela e instalador dependem de APIs do Windows; teste em Windows 11 Home é obrigatório.
- Assinatura de código evita alertas do Defender; sem certificado, prever instrução de instalação.

### 4.7 Licenças e propriedade intelectual
- Não copiar prompts de sistema, textos, ícones ou identidade visual do Claude.
- O formato `SKILL.md` deve ser verificado quanto à licença antes de adoção.
- Componentes de terceiros (Monaco, xterm.js, whisper.cpp, SearXNG, Electron) têm licenças próprias. Conferir compatibilidade com a licença escolhida para o Zenith.

### 4.8 Itens marcados "(verificar)" no inventário
Doze itens do documento 01 dependem de confirmação: F037, F038, F056, F061, F062, F076, F083, F087, F114, F116, F117, F119. Cada um deve ser verificado nas fontes oficiais **antes do passo onde é entregue**. Se algum não existir como descrito, o item sai da lista e a cifra cai.

### 4.9 Paridade de qualidade
- O plano mede presença de função. Não mede se o agente resolve tarefas como o Claude ou o Claude Code.
- **Recomendação:** criar, no passo 1, um conjunto de **30 tarefas de referência** (código, pesquisa, documento, automação), com resultado esperado. Rodar o Zenith e o Claude Code no mesmo projeto e medir: taxa de sucesso, intervenções do usuário e tempo. Repetir no fim de cada fase.

---

## 5. Itens que mais pesam no prazo

Ordem sugerida para cortar, caso o prazo aperte, sem perder a identidade do produto:

1. Controle de computador (F059) e extensão de navegador (F060): podem ir para a versão 1.1.
2. Complemento do Office (F117): pode sair do 1.0 se a distribuição for um problema.
3. Modo web e mobile (F082, F089): podem ser entregues depois do desktop estável.
4. Reuniões (F061): pode ser entregue como transcrição simples, sem resumo, no 1.0.
5. Equipes de agentes (F083): podem ser entregues como execução paralela simples, sem painel.

Cortar qualquer um desses reduz a cifra de paridade. O documento 04 mantém a cifra com o escopo completo.

---

## 6. Veredito

- **No papel:** o plano revisado cobre **126 de 126** funções ativas, com **121 em paridade completa (96,0%)** e **5 em paridade parcial declarada**. Atinge a meta de 95%.
- **Na prática:** a meta depende de prazo, de segurança e de qualidade dos modelos locais. Os três riscos maiores são o controle de tela e de navegador (passo 29), a qualidade das chamadas de ferramenta em modelos locais (passo 15) e a distribuição das extensões (passo 23 e 30).
- **O que fazer agora:** definir o marco de uso diário (4.1), decidir a distribuição (4.4), e criar as 30 tarefas de referência (4.9).
