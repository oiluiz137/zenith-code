---
name: skill-creator
description: Cria uma nova skill no formato SKILL.md, testa o gatilho e melhora a descrição.
---

# Criar skills

Versão original escrita para o Zenith.

1. Crie a pasta `skills/<nome-em-minusculas>/` com um arquivo `SKILL.md`.
2. O arquivo começa com frontmatter: `name` (igual ao nome da pasta) e `description` (uma frase dizendo quando usar).
3. O corpo tem passos numerados e curtos. Inclua o que NÃO fazer.
4. Teste: peça ao Zenith uma tarefa que deve acionar a skill e confirme que ela foi carregada.
5. Se a skill não for acionada, reescreva a descrição com as palavras que o usuário costuma usar.
