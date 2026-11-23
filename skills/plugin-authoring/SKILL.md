---
name: plugin-authoring
description: Ajuda a criar plugins do Zenith com manifesto, skills, comandos, hooks e servidores MCP.
---

# Criar plugins

Versão original escrita para o Zenith. Status: o carregador de plugins completo é planejado (passo 23).

1. Crie a pasta `plugins/<nome>/` com `zenith-plugin.json` (nome, versão, descrição, permissões pedidas).
2. Coloque as skills em `plugins/<nome>/skills/`.
3. Declare hooks em `hooks.json` do plugin, com matcher e comando.
4. Liste no manifesto qualquer servidor MCP e as permissões que ele exige.
5. Teste cada parte isoladamente antes de empacotar.
