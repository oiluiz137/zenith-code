# Zenith Code 1.0

Assistente de IA local e de nuvem, com agente de código, ferramentas com permissão, skills, hooks, terminal e pesquisa na web. Roda no seu computador. Não tem conta, login nem telemetria.

## Como rodar

Requisitos: Node.js 22 ou superior e um modelo. O modelo local roda dentro do próprio Zenith (llama.cpp via node-llama-cpp): basta colocar um arquivo `.gguf` na pasta `models/`. Também é possível usar uma chave de API (OpenAI, Anthropic, OpenRouter).

```powershell
npm install
npm run build
npm start
```

Abra http://127.0.0.1:5178 no navegador.

Para desenvolvimento, com recarga automática:

```powershell
npm run dev
```

Depois abra http://localhost:5173.

## Primeiro uso

1. Baixe um modelo em formato GGUF (por exemplo, Qwen3-8B-Q4_K_M.gguf, cerca de 5 GB) e coloque em `models/`.
2. Em **Configurações > Modelos e provedores**, deixe "Modelo local" ativo e escolha o modelo padrão.
3. Escolha o modo. **Perguntar** é o padrão: leituras são livres e escrita, comandos e web pedem aprovação.

## Modos de permissão

| Modo | Leitura | Escrita de arquivo | Comandos e web |
|---|---|---|---|
| Perguntar | livre | pede aprovação | pede aprovação |
| Aceitar edições | livre | automática | pede aprovação |
| Plano | livre | bloqueada | bloqueados |
| Sem aprovação | livre | automática | automáticos (cuidado) |

Em cada cartão de permissão, "Sempre permitir" grava o padrão em Configurações (para comandos, pelo primeiro termo, por exemplo `run_command:npm`).

## Ferramentas do agente

`list_dir`, `read_file`, `search_text`, `write_file`, `edit_file`, `run_command`, `web_search`, `web_fetch`, `load_skill`. Todas as operações de arquivo ficam dentro da pasta de trabalho (padrão: `workspace/`).

## Desfazer

O botão **Desfazer** restaura o conteúdo anterior do último arquivo alterado pelo agente. Os checkpoints ficam em `.zenith-data/zenith.db`.

## Skills

Uma skill é uma pasta com `SKILL.md`:

```
<pasta de trabalho>/.zenith/skills/<nome>/SKILL.md
skills/<nome>/SKILL.md            (exemplo incluído: revisar-codigo)
```

O arquivo começa com frontmatter:

```markdown
---
name: revisar-codigo
description: O que a skill faz, em uma linha.
---

Instruções para o modelo.
```

No chat, digite `/revisar-codigo` (com texto opcional depois) para acionar a skill. O modelo também vê o índice de skills e pode carregar uma com `load_skill`.

## Hooks

Em `<pasta de trabalho>/.zenith/hooks.json`:

```json
{
  "PreToolUse": [{ "matcher": "run_command", "command": "node scripts/bloqueia.js" }],
  "PostToolUse": []
}
```

Um hook `PreToolUse` que sair com código `2` bloqueia a ferramenta. A saída do hook vira o motivo mostrado ao modelo. Variáveis disponíveis: `ZENITH_EVENT`, `ZENITH_TOOL_NAME`, `ZENITH_TOOL_INPUT`.

## Estrutura

```
server/   núcleo: provedores, agente, ferramentas, permissões, skills, hooks, SQLite
src/      interface React
skills/   skills de exemplo
docs/     planejamento (inventário, plano de 30 passos, crítica e interface)
```

## Dados

Tudo fica em `.zenith-data/zenith.db` (SQLite) e na pasta `workspace/`. Nada é enviado aos servidores do Zenith, que não existem. Chamadas de rede vão apenas aos provedores que você ativar e às buscas web.

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE). Você pode usar, estudar, modificar e redistribuir o Zenith Code, inclusive versões modificadas, **somente para fins não comerciais**. Qualquer uso comercial precisa de autorização do autor.

As skills de terceiros em `skills/` mantêm a licença original (MIT). Veja [skills/THIRD_PARTY_LICENSES.md](skills/THIRD_PARTY_LICENSES.md).
