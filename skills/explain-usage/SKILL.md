---
name: explain-usage
description: Explica onde foram os tokens da conversa atual, com um resumo simples por mensagem e por ferramenta.
---

# Explicar uso de tokens

Versão original escrita para o Zenith.

1. Conte os caracteres de cada mensagem e divida por quatro para estimar tokens.
2. Some as chamadas de ferramenta e os resultados separadamente.
3. Mostre os cinco itens que mais gastaram, em uma lista curta.
4. Diga que a contagem é estimada, porque o modelo local usa outro tokenizador.
