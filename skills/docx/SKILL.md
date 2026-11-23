---
name: docx
description: Cria e edita documentos Word (.docx) com títulos, listas, tabelas e imagens. Use quando o pedido for um arquivo Word.
---

# Documentos Word (.docx)

Versão original escrita para o Zenith. Função equivalente à skill de Word do Claude.

1. Confirme o título, o público e as seções antes de gerar.
2. Gere o arquivo com `python-docx` (ou `docx` no Node). Use estilos de título (Heading 1, 2) em vez de texto em negrito.
3. Tabelas: cabeçalho em negrito, largura proporcional ao conteúdo.
4. Para editar um arquivo existente, leia o texto com `read_file` antes e altere só os trechos pedidos.
5. Ao final, informe o caminho do arquivo gerado na pasta de trabalho.
