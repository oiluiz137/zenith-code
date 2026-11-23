---
name: fewer-permission-prompts
description: Analisa as ações que o usuário mais aprova e sugere uma lista curta de regras "sempre permitir" para reduzir perguntas.
---

# Menos pedidos de permissão

Versão original escrita para o Zenith.

1. Leia o log de auditoria local (tool_runs da conversa).
2. Liste os padrões de comando aprovados mais de duas vezes.
3. Sugira só comandos de leitura ou de teste. Nunca sugira apagar ou instalar pacotes como regra permanente.
4. Mostre a lista e peça confirmação antes de salvar em `.zenith/config.json`.
