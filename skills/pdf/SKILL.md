---
name: pdf
description: Lê PDFs (texto e tabelas), junta, divide, gira e preenche formulários. Use quando o arquivo de entrada ou a saída for PDF.
---

# PDF

Versão original escrita para o Zenith.

1. Para extrair texto, use `pypdf` ou `pdfplumber` por `run_command`. Peça o intervalo de páginas quando o arquivo for grande.
2. Para tabelas, prefira `pdfplumber`, que mantém colunas.
3. Para juntar ou dividir, trabalhe com cópias e informe quantas páginas cada arquivo tem.
4. PDF escaneado sem texto precisa de OCR (`pytesseract`). Avise o usuário antes de rodar, porque é lento.
5. Nunca sobrescreva o PDF original.
