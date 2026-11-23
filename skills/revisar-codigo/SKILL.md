---
name: revisar-codigo
description: Revisa alterações de código e aponta bugs, riscos de segurança e melhorias, em lista numerada.
---

# Revisar código

Ao ser acionada:

1. Use `list_dir` e `read_file` para localizar os arquivos alterados ou pedidos pelo usuário.
2. Para cada problema encontrado, informe:
   - arquivo e linha aproximada;
   - severidade (crítica, alta, média, baixa);
   - o que pode dar errado;
   - uma correção sugerida, em trecho curto.
3. Não altere arquivos. Termine com um resumo: quantidade de itens por severidade e o que priorizar.
