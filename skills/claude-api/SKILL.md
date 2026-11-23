---
name: claude-api
description: Referência para usar APIs de modelos de linguagem: mensagens, streaming, ferramentas, cache de prompt e lote. Use ao escrever código que chama um modelo.
---

# APIs de modelos

Versão original escrita para o Zenith, com foco nos conceitos gerais.

1. Mensagens: sequência de papéis (sistema, usuário, assistente). O sistema vai em campo separado quando a API exige.
2. Streaming: leia eventos incrementais de texto e de chamada de ferramenta.
3. Ferramentas: descreva cada função com nome, descrição e esquema JSON dos parâmetros.
4. Cache de prompt: mantenha o início do prompt estável para reaproveitar o processamento.
5. Lote: use para muitas tarefas independentes que não precisam de resposta imediata.
