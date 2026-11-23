---
name: import-memory
description: Importa fatos e preferências de uma exportação de outro assistente (texto ou JSON) para a memória do Zenith, com revisão.
---

# Importar memória

Versão original escrita para o Zenith.

1. Peça o arquivo de exportação e leia o conteúdo com `read_file`.
2. Extraia só fatos sobre o usuário e preferências. Ignore conversas inteiras.
3. Mostre a lista para revisão. O usuário escolhe o que entra.
4. Acrescente o aprovado em `.zenith/memoria.md`.
