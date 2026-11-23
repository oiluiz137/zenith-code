---
name: security-review
description: Faz revisão de segurança das mudanças pendentes: segredos expostos, injeção, permissões e entradas não validadas.
---

# Revisão de segurança

Versão original escrita para o Zenith.

1. Procure chaves, tokens e senhas nos arquivos alterados.
2. Verifique entradas de usuário usadas em comandos de shell, consultas SQL ou HTML.
3. Confira caminhos de arquivo: eles devem ficar dentro da pasta de trabalho.
4. Liste cada achado com severidade (alta, média, baixa) e a correção.
