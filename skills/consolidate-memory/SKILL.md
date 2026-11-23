---
name: consolidate-memory
description: Revisa a memória do usuário, funde itens duplicados, corrige fatos desatualizados e remove o que não serve mais.
---

# Consolidar memória

Versão original escrita para o Zenith.

1. Leia `.zenith/memoria.md` com `read_file`.
2. Agrupe itens que falam do mesmo assunto em uma linha.
3. Marque como desatualizado o que conflita com algo mais recente.
4. Mostre a lista de mudanças antes de gravar e espere a aprovação do usuário.
5. Grave o resultado com `write_file`, mantendo o formato de lista.
