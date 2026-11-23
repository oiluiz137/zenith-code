---
name: simplify
description: Revisa o código alterado procurando repetição, código morto e formas mais simples de fazer a mesma coisa. Não procura bugs.
---

# Simplificar

Versão original escrita para o Zenith.

1. Identifique os arquivos alterados (git diff ou os citados pelo usuário).
2. Procure trechos repetidos que podem virar uma função.
3. Remova código morto e variáveis não usadas.
4. Aplique as mudanças com `edit_file`, uma por vez, e confirme que o comportamento não mudou.
