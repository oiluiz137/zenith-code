# 05 — Plano de interface do Zenith (escopo revisado)

Objetivo: uma interface **própria** com as mesmas capacidades do Claude (chat, projetos, artifacts, agente de código, Cowork, automação, voz, pesquisa, skills, plugins, MCP, terminal), sem tela de conta, login ou telemetria.

Identidade visual, nomes e textos são decisões do Zenith (passo 3 do doc 03). Não copiar aparência, textos ou ícones do Claude.

---

## 1. Princípios

1. **Transparência do agente.** Toda ação aparece como cartão: o que fez, o resultado e se pediu permissão.
2. **Modelo e localização sempre visíveis.** Cada conversa mostra o modelo e um selo "local" ou "nuvem".
3. **Modos explícitos.** Chat, Agente, Plano e Sem aprovação têm rótulo e cor próprios. "Sem aprovação" é o único modo com alerta permanente.
4. **Controle do que é automático.** Tudo que age sem a presença do usuário (agendamentos, Cowork, controle de tela, navegador) mostra estado e tem botão de parar.
5. **Teclado primeiro.** Ações frequentes têm atalho e aparecem na paleta de comandos.
6. **Reversível.** Todo passo do agente gera checkpoint, visível na conversa.
7. **Sem conta e sem nuvem.** Nenhuma tela pede login. Dados locais têm tela própria para exportar e apagar.
8. **Estado sempre explicado.** Carregando, vazio, erro e sem permissão têm mensagem e próxima ação.

---

## 2. Layout principal

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ☰ Zenith  [Projeto: app-tarefas ▾]     [Modelo: qwen-coder 32B ● local ▾]  [Modo: Agente ▾]  ⚙ │
├────┬──────────────────┬────────────────────────────────────────┬─────────────────┤
│ ▣  │ + Nova conversa  │  Conversa: "Criar API de tarefas"      │  PAINEL          │
│ 💬 │ 🔍 Buscar  Ctrl+K│                                        │  artifact,       │
│ 📁 │ PROJETOS         │  [usuário] crie a API com Express      │  preview, diff,  │
│ 💻 │  · app-tarefas   │                                        │  editor, fontes, │
│ ⏱  │ CONVERSAS        │  [agente] ▸ Lendo package.json   ✓     │  gráficos        │
│ 🧩 │  Hoje            │  [agente] ▸ Editando src/app.ts        │                  │
│ 🔌 │   · Criar API ◀  │    ┌ Permissão ───────────────────┐    │                  │
│ ⚙  │  Ontem           │    │ npm install express           │    │                  │
│    │   · Revisar PR   │    │ [Permitir] [Sempre] [Negar]   │    │                  │
│    │                  │    └───────────────────────────────┘    │                  │
│    │                  │ ┌────────────────────────────────────┐  │                  │
│    │                  │ │ 📎 Ferramentas ▾  🎙  ⌁ 12k/128k  ➤ │  │                  │
│    │                  │ └────────────────────────────────────┘  │                  │
├────┴──────────────────┴────────────────────────────────────────┴─────────────────┤
│ ▸ Terminal  [PowerShell] [WSL] [+]    ● Agente: executando  · main ✓ · 2 processos │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Regiões:
- **R1 — Barra superior:** projeto, modelo e localização, modo, configurações.
- **R2 — Barra de atividade:** troca de visão (Conversas, Projetos, Código, Automações, Skills, Plugins, MCP, Pesquisa, Equipe de agentes).
- **R3 — Barra lateral:** conteúdo da visão atual.
- **R4 — Área principal:** conversa, editor, painel de automação ou relatório.
- **R5 — Painel lateral:** artifact, preview, diff, fontes, gráficos, Cowork.
- **R6 — Dock inferior:** terminal com abas e processos em segundo plano. Oculto com Ctrl+`.
- **R7 — Barra de status:** estado do agente, ramo git, erros, processos, controle de tela ativo.

---

## 3. Visões (navegação)

| Visão | Conteúdo | Funções atendidas |
|---|---|---|
| Conversas | Lista, busca, chat, voz | F001–F011, F015, F016, F021, F022 |
| Projetos | Instruções, base de conhecimento, memória de projeto | F026–F029, F046 |
| Código | Árvore, editor, diff, git, worktrees, LSP, terminal | F066, F079, F080, F081, F136 |
| Automações | Agendamentos, Cowork, controle de tela, navegador | F057–F060 |
| Equipe de agentes | Sessões, tarefas compartilhadas, mensagens | F083 |
| Skills | Lista, editor de SKILL.md, testes | F053, F122, F123 |
| Plugins | Instalados, marketplace, extensões de desktop, complementos | F054–F056, F116, F117 |
| MCP e conectores | Servidores, conectores, ferramentas, log | F050, F051, F073, F127 |
| Pesquisa | Pesquisa profunda, sessão proativa, fontes | F047, F048, F062 |
| Dados e gráficos | Tabelas, gráficos, código executado | F049 |
| Auditoria | Execuções, permissões, hooks (local) | F068, F125 |

Trocar de visão não interrompe o agente. Um agendamento pode rodar enquanto o usuário conversa.

---

## 4. Telas (inventário)

| ID | Tela | Conteúdo principal | Passo |
|---|---|---|---|
| SC-01 | Primeiro uso | Escolha local ou nuvem, baixar modelo conforme RAM e VRAM, criar projeto. Sem conta | 30 (rascunho no 7) |
| SC-02 | Conversa | Mensagens, cartões, permissões, composer | 9 |
| SC-03 | Paleta de comandos | Ações, conversas, arquivos, skills, comandos | 3, 10 |
| SC-04 | Projeto | Instruções, base de conhecimento, memória do projeto | 12, 13 |
| SC-05 | Painel de artifact | Código e preview, versões, publicar, baixar | 14 |
| SC-06 | Código | Árvore, editor, abas | 19 |
| SC-07 | Diff e revisão | Lado a lado, aceitar ou rejeitar por trecho | 17, 19 |
| SC-08 | Git e worktrees | Status, commits, branches, PRs, worktree por tarefa | 20 |
| SC-09 | Terminal | Abas, saída, processos, segundo plano | 18 |
| SC-10 | Preview fullstack | Iframe com URL local, console, reiniciar servidor | 27 |
| SC-11 | Pesquisa profunda | Plano, fontes em tempo real, relatório | 26 |
| SC-12 | Skills | Lista, editor de SKILL.md, testar, comandos embutidos | 22 |
| SC-13 | Marketplace e plugins | Catálogo, permissões antes de instalar, verificação | 23 |
| SC-14 | MCP e conectores | Servidores, estado, log, conectores com credenciais locais | 25 |
| SC-15 | Hooks | Lista por evento, log de disparos | 24 |
| SC-16 | Modelos | Instalados, capacidades, baixar, remover, testar | 6, 7 |
| SC-17 | Provedores | Chaves no cofre, URL base, teste de conexão | 7 |
| SC-18 | Permissões | Modos, regras por projeto, sandbox | 16, 18 |
| SC-19 | Memória | Global e de projeto, editar e apagar | 28 |
| SC-20 | Auditoria | Execuções, filtros, exportar (local) | 16 |
| SC-21 | Avaliação de modelos | Resultados da suíte de chamadas de ferramenta | 15 |
| SC-22 | Configurações | Abas: geral, modelos, agente, memória, skills, plugins, MCP, web, aparência, idioma, atalhos, voz, dados locais, sobre | 3, 4, 8 |
| SC-23 | Atalhos | Lista e personalização | 3 |
| SC-24 | Janela rápida | Campo flutuante com atalho global | 3 |
| SC-25 | Bandeja | Estado do agente, abrir, pausar automações, sair | 3 |
| SC-26 | Agendamentos | Lista de tarefas, próximo disparo, histórico, editar | 29 |
| SC-27 | Cowork | Pastas concedidas, painel de tarefa, arquivos alterados | 29 |
| SC-28 | Controle de tela | Visualização, aprovação por aplicativo, parar | 29 |
| SC-29 | Extensão de navegador | Estado de conexão, sites autorizados | 29 |
| SC-30 | Equipe de agentes | Sessões ativas, tarefas, mensagens | 21 |
| SC-31 | Reuniões | Gravador, transcrição, resumo e ações | 13 |
| SC-32 | Dados e gráficos | Tabela, gráfico gerado, código executado | 27 |
| SC-33 | Sessões remotas | Código de pareamento, dispositivos da rede, sessões em segundo plano | 30 |
| SC-34 | Diagnóstico | Resultado do `/doctor` com correções | 18 |
| SC-35 | Hooks de notificação | Configuração de avisos | 24 |

---

## 5. Componentes

### 5.1 Composer
- Campo multilinha com crescimento automático (até 40% da altura). Modo Vim opcional.
- **Anexar:** clique, arrastar, colar imagem, colar texto longo (vira arquivo acima de limite).
- **Voz:** botão de ditado e de conversa falada, com indicador de escuta.
- **Seletor de modelo:** selo local ou nuvem e capacidades.
- **Seletor de modo:** Chat, Agente, Plano, Sem aprovação.
- **Ferramentas da conversa:** web, skills, MCP, terminal, Cowork, controle de tela.
- **Contador de contexto:** barra de uso; acima de 80%, sugere compactar.
- **Gatilhos:** `/` para comandos, skills, plugins e recursos MCP; `@` para arquivos, pastas, servidores e subagentes.
- **Enviar e parar:** o botão muda durante a geração.

### 5.2 Mensagens
- Markdown com realce, tabelas, LaTeX e cópia de bloco.
- **Raciocínio:** colapsado por padrão, com contador de tokens.
- **Cartão de ferramenta:** nome, argumentos resumidos, estado (executando, ok, erro, bloqueado), duração, detalhe.
- **Cartão de permissão:** ação, diff ou comando completo, botões Permitir uma vez, Sempre para este padrão, Negar. Pendente bloqueia o agente.
- **Cartão de subagente:** nome, tarefa, progresso, resumo.
- **Cartão de equipe:** agentes, tarefa atribuída, arquivos em uso.
- **Lista de tarefas:** itens com estado, atualizada no lugar.
- **Marcador de checkpoint:** "Restaurar aqui".
- **Citações:** números que abrem a fonte no painel.
- **Ramificações:** `< 2/3 >`.
- **Cartão de gráfico:** imagem ou tabela gerada, com código da análise.

### 5.3 Painel lateral
- Abas: Artifact, Preview, Diff, Fontes, Arquivo, Gráficos, Cowork.
- Cabeçalho com título, versão e ações: copiar, baixar, publicar localmente, tela cheia.

### 5.4 Terminal
- Abas por perfil (PowerShell, cmd, WSL, Git Bash, bash).
- Comandos do agente marcados com ícone e cor distintos.
- Tarefas em segundo plano listadas, com saída e botão de encerrar.

### 5.5 Barra de status
- Estado do agente: ocioso, pensando, executando, aguardando permissão, erro.
- Ramo git e alterações.
- Processos ativos: servidores dev, terminais, automações.
- Indicador de **controle de tela ativo** em vermelho, com botão de parar.

### 5.6 Avisos
- Toast para tarefa concluída, com opção de abrir.
- Banner para contexto cheio, falha de provedor, modelo sem ferramentas (com fallback sugerido).
- Modal somente para ação destrutiva ou permissão de alto risco.

---

## 6. Fluxos principais

### 6.1 Primeiro uso (SC-01)
1. Escolher local, nuvem ou ambos. Não há tela de conta.
2. Local: detectar Ollama, LM Studio e llama.cpp; se ausentes, mostrar instrução. Sugerir modelo conforme RAM e VRAM detectadas.
3. Nuvem: colar chave (guardada no cofre local) e testar conexão.
4. Criar projeto ou abrir pasta existente.
5. Mensagem de exemplo mostra um cartão de ferramenta em ação.

Meta: conversa respondida em menos de 10 minutos.

### 6.2 Criar app fullstack (passo 27)
1. Pedido: "crie um app de tarefas com React e API".
2. Agente propõe plano em modo Plano e pede aprovação.
3. Usuário aprova. Projeto criado a partir de template; cada arquivo aparece no diff.
4. Cartão de permissão para `npm install`.
5. Servidor dev inicia; preview aparece no painel (SC-10).
6. Erro de build vai ao terminal; agente lê, corrige e mostra o novo diff.

### 6.3 Aprovar comando perigoso
1. Agente pede `rm -rf build` (ou equivalente).
2. Cartão mostra o comando completo, a pasta de execução e aviso de ação destrutiva.
3. Botões: Permitir uma vez, Negar. "Sempre" não aparece para comandos destrutivos.
4. Decisão fica no log de auditoria local (SC-20).

### 6.4 Controle de tela (passo 29)
1. Agente pede ação em um aplicativo.
2. Cartão mostra o aplicativo, a ação e a captura atual.
3. Permitir uma vez ou para o aplicativo nesta sessão. Negar.
4. Enquanto age, a barra de status fica vermelha e o botão de parar aparece em destaque. Tecla de parada global disponível.

### 6.5 Agendamento (passo 29)
1. Usuário cria tarefa em SC-26: nome, prompt, pasta, horário ou recorrência, permissões.
2. Ao disparar, aparece notificação e entrada no histórico.
3. Tarefa que precisa de permissão não pergunta em silêncio: fica pendente e notifica.

### 6.6 Instalar plugin (passo 23)
1. Marketplace (SC-13) mostra o plugin.
2. Tela lista permissões pedidas e resultado da verificação estática.
3. Instalar exige confirmação. Plugin fica desativado até a primeira ativação.

### 6.7 Pesquisa profunda (passo 26)
1. Usuário ativa pesquisa e envia a pergunta.
2. Agente mostra o plano de consultas e começa.
3. Fontes aparecem em tempo real no painel "Fontes".
4. Relatório final vira artifact com citações numeradas.

### 6.8 Voltar no tempo (passo 17)
1. "Restaurar aqui" em um marcador de checkpoint.
2. Diálogo mostra arquivos que serão revertidos e mensagens mantidas ou arquivadas.
3. Confirmação; restauração registrada como evento na conversa.

### 6.9 Pareamento remoto (passo 30)
1. Em SC-33, o app gera código de uso único e endereço na rede local.
2. No navegador ou celular, o usuário digita o código.
3. Sessão ativa; o código expira e não pode ser reutilizado. Nenhuma conta é criada.

---

## 7. Atalhos sugeridos

| Ação | Atalho |
|---|---|
| Paleta de comandos | Ctrl+K |
| Janela rápida (global) | Atalho do sistema, configurável |
| Nova conversa | Ctrl+N |
| Buscar em conversas | Ctrl+Shift+F |
| Barra lateral | Ctrl+B |
| Painel lateral | Ctrl+J |
| Terminal | Ctrl+` |
| Trocar modelo | Ctrl+M |
| Trocar modo | Ctrl+Shift+M |
| Ditado | Ctrl+Shift+Espaço |
| Conversa falada | Ctrl+Shift+V |
| Enviar | Ctrl+Enter (configurável para Enter) |
| Parar geração ou agente | Esc |
| Parar controle de tela | Ctrl+Shift+Esc |
| Aprovar permissão em foco | Ctrl+Enter |
| Negar permissão em foco | Esc |
| Configurações | Ctrl+, |

Todos os atalhos aparecem em SC-23 e podem ser alterados.

---

## 8. Sistema visual (diretrizes)

- **Cores semânticas:** fundo, superfície, borda, texto primário e secundário, acento, sucesso, alerta, perigo.
- **Cores de localização:** local e nuvem, sem se confundir com sucesso ou erro.
- **Modos:** cada modo do composer tem cor própria. "Sem aprovação" e "controle de tela ativo" usam o alerta.
- **Tipografia:** uma fonte de interface e uma monoespaçada para código, terminal e diff. Escala fixa.
- **Espaçamento:** grade de 4 px.
- **Ícones:** conjunto único; cada um com rótulo acessível.
- **Tema:** claro e escuro, com contraste verificado automaticamente (passo 3).
- **Paleta própria:** definida no passo 3.

---

## 9. Acessibilidade

- Meta: **WCAG 2.2 AA**.
- Teclado completo, com foco visível.
- Região `aria-live` para streaming, com anúncio controlado (sem narrar cada token).
- Cartões de permissão recebem foco ao aparecer.
- Respeito a "reduzir movimento".
- Escala de fonte de 100% a 150% sem quebra de layout.
- Diff e terminal legíveis por leitor de tela, linha a linha.
- Voz: legendas da resposta falada e transcrição visível do ditado.

---

## 10. Estados e comportamentos

| Estado | Comportamento |
|---|---|
| Vazio | Sugestões de início e atalho para primeiro projeto |
| Carregando modelo | Barra de progresso e opção de usar outro modelo |
| Provedor fora do ar | Banner com troca de provedor, sem perder o texto |
| Modelo sem ferramentas | Aviso e fallback visível |
| Permissão negada | Cartão mostra a negação; o agente ajusta o plano |
| Contexto cheio | Sugestão de compactar; compactação aparece como evento |
| Erro de ferramenta | Cartão vermelho com detalhe e tentar de novo |
| Agente travado | Botão de parar após 10 s sem progresso |
| Automação sem permissão | Tarefa fica pendente e notifica |
| Extensão de navegador desconectada | Status em SC-29 e aviso na barra |

---

## 11. Responsividade

- **Largo (acima de 1280 px):** todas as regiões.
- **Médio (900–1280 px):** painel lateral vira sobreposição; barra de atividade recolhida.
- **Estreito (abaixo de 900 px):** uma coluna; barra lateral e painel viram gavetas.
- **Celular (PWA, passo 30):** abas inferiores; painéis em folhas; terminal restrito a leitura.

---

## 12. Mapeamento para o plano de desenvolvimento

| Passo | Entregável de interface |
|---|---|
| 3 | Shell, tema, idioma, acessibilidade, atalhos, janela rápida (SC-24), bandeja (SC-25), paleta (SC-03), ajuda |
| 4 | Configurações em camadas, cofre, dados locais (SC-22) |
| 6–7 | Modelos e provedores (SC-16, SC-17) |
| 8 | Estilos e parâmetros (SC-22) |
| 9 | Conversa, composer, voz, modo Vim (SC-02) |
| 10 | Barra lateral, busca, retomada |
| 11 | Ramificação, exportação, compartilhamento |
| 12–13 | Projetos, base, reuniões (SC-04, SC-31) |
| 14 | Painel de artifact (SC-05) |
| 15 | Cartões de execução, CLI, avaliação (SC-21) |
| 16 | Permissões e auditoria (SC-18, SC-20) |
| 17 | Diff e checkpoints (SC-07) |
| 18 | Terminal, segundo plano, diagnóstico (SC-09, SC-34) |
| 19 | Editor e LSP (SC-06) |
| 20 | Git e worktrees (SC-08) |
| 21 | Subagentes e equipe de agentes (SC-30) |
| 22 | Skills e comandos (SC-12) |
| 23 | Marketplace, extensões, complementos (SC-13) |
| 24 | Hooks e notificações (SC-15, SC-35) |
| 25 | MCP e conectores (SC-14) |
| 26 | Pesquisa profunda e proativa (SC-11) |
| 27 | Preview e dados (SC-10, SC-32) |
| 28 | Memória (SC-19) |
| 29 | Automações, Cowork, controle de tela, navegador (SC-26 a SC-29) |
| 30 | Pareamento remoto, PWA, primeiro uso (SC-01, SC-33) |

---

## 13. Critérios de aceite da interface (1.0)

1. Todo passo do agente aparece como cartão e pode ser inspecionado depois.
2. Nenhuma ação sensível ocorre sem cartão de permissão.
3. Modelo e localização aparecem em toda conversa.
4. Controle de tela e automações têm indicador visível e botão de parar.
5. Interface completa em português e em inglês.
6. Passa na verificação automática de contraste e de foco (passo 3 e passo 30).
7. Nenhuma tela pede login ou conta.
8. Primeiro uso concluído por usuário de teste em menos de 10 minutos.
