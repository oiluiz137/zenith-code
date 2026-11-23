---
name: code-review
description: Revisa um diff ou pull request procurando erros de lógica, casos de borda e regras do projeto. Use quando pedirem revisão de código.
---

# Revisão de código

Versão original escrita para o Zenith. Acionada pelo comando /review.

1. Leia o diff completo antes de comentar.
2. Numere cada achado (1, 2, 3...). Para cada um: arquivo, linha, o que pode dar errado e uma correção sugerida.
3. Separe os achados em três grupos: erro certo, risco provável e sugestão de estilo.
4. Termine com um resumo: quantidade de achados por grupo e o que corrigir primeiro.
5. Não comente formatação que o linter já cobre.
