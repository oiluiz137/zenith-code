---
name: xlsx
description: Cria e edita planilhas Excel (.xlsx) e CSV, com fórmulas, formatação e gráficos.
---

# Planilhas (.xlsx e CSV)

Versão original escrita para o Zenith.

1. Abra o arquivo com `openpyxl` (ou `pandas` para análise). Não converta para CSV se houver fórmulas.
2. Fórmulas devem ficar como texto de fórmula (`=SOMA(A1:A10)`), não como valor calculado.
3. Cabeçalhos na linha 1, sem células mescladas em tabelas de dados.
4. Para gráficos, use o tipo mais simples que responde à pergunta.
5. Diga ao usuário quais abas e intervalos foram alterados.
