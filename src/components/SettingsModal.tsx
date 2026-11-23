import { useEffect, useMemo, useState } from "react";
import type { Mode, ProviderConfig, Settings } from "../../server/types";
import { api } from "../api";
import { Icon, type IconName } from "./Icons";
import { MODE_LABELS } from "./Composer";

export type Tab = "geral" | "modelos" | "agente" | "memoria" | "skills" | "plugins" | "mcp" | "web" | "aparencia" | "idioma" | "atalhos" | "voz" | "dados" | "sobre";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "geral", label: "Geral", icon: "settings" },
  { id: "modelos", label: "Modelos e provedores", icon: "cube" },
  { id: "agente", label: "Agente e permissões", icon: "shield" },
  { id: "memoria", label: "Memória", icon: "book" },
  { id: "skills", label: "Skills", icon: "spark" },
  { id: "plugins", label: "Plugins", icon: "puzzle" },
  { id: "mcp", label: "MCP e conectores", icon: "plug" },
  { id: "web", label: "Pesquisa na web", icon: "globe" },
  { id: "aparencia", label: "Aparência", icon: "sun" },
  { id: "idioma", label: "Idioma", icon: "chat" },
  { id: "atalhos", label: "Atalhos", icon: "keyboard" },
  { id: "voz", label: "Voz", icon: "speaker" },
  { id: "dados", label: "Dados locais", icon: "server" },
  { id: "sobre", label: "Sobre", icon: "doc" },
];

interface Props {
  settings: Settings;
  skills: { name: string; description: string }[];
  hooks: Record<string, unknown>;
  theme: "claro" | "escuro";
  onTheme: (t: "claro" | "escuro") => void;
  onSaved: (s: Settings) => void;
  onClose: () => void;
  initialTab?: Tab;
  page?: boolean;
}

export const SHORTCUTS: [string, string][] = [
  ["Paleta de comandos e busca", "Ctrl+K"],
  ["Nova conversa", "Ctrl+N"],
  ["Mostrar ou ocultar a barra lateral", "Ctrl+B"],
  ["Mostrar ou ocultar o painel", "Ctrl+J"],
  ["Configurações", "Ctrl+,"],
  ["Enviar mensagem", "Enter"],
  ["Nova linha", "Shift+Enter"],
  ["Cancelar edição", "Esc"],
  ["Skills e comandos", "/ no início da mensagem"],
];

export function SettingsModal({ settings, skills, hooks, theme, onTheme, onSaved, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "geral");
  const [draft, setDraft] = useState<Settings>(settings);
  const [memory, setMemory] = useState("");
  const [memoryLoaded, setMemoryLoaded] = useState("");
  const [disabled, setDisabled] = useState<string[]>([]);
  const [disabledLoaded, setDisabledLoaded] = useState<string[]>([]);
  const [mcp, setMcp] = useState<{ name: string; tools: string[]; error?: string }[] | null>(null);
  const [skillQuery, setSkillQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState(() => localStorage.getItem("zenith-voice") ?? "");
  const [rate, setRate] = useState(() => Number(localStorage.getItem("zenith-rate") ?? "1"));

  const [modelsDir, setModelsDir] = useState("");
  useEffect(() => {
    api.modelsDir().then((r) => setModelsDir(r.path)).catch(() => undefined);
    api.memory().then((r) => { setMemory(r.content); setMemoryLoaded(r.content); }).catch(() => undefined);
    api.disabledSkills().then((d) => { setDisabled(d); setDisabledLoaded(d); }).catch(() => undefined);
    api.mcp().then(setMcp).catch(() => setMcp([]));
    if ("speechSynthesis" in window) {
      const load = () => setVoices(window.speechSynthesis.getVoices());
      load();
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings) || memory !== memoryLoaded || JSON.stringify(disabled) !== JSON.stringify(disabledLoaded),
    [draft, settings, memory, memoryLoaded, disabled, disabledLoaded],
  );

  function updateProvider(id: string, patch: Partial<ProviderConfig>) {
    setDraft((d) => ({ ...d, providers: d.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveSettings({
        providers: draft.providers,
        defaultProvider: draft.defaultProvider,
        defaultModel: draft.defaultModel,
        workspace: draft.workspace,
        mode: draft.mode,
        searxngUrl: draft.searxngUrl,
        temperature: draft.temperature,
        topP: draft.topP,
        responseStyle: draft.responseStyle,
        maxTokens: draft.maxTokens,
        customPrompt: draft.customPrompt,
        alwaysAllow: draft.alwaysAllow,
      });
      if (memory !== memoryLoaded) {
        await api.saveMemory(memory);
        setMemoryLoaded(memory);
      }
      if (JSON.stringify(disabled) !== JSON.stringify(disabledLoaded)) {
        await api.setDisabledSkills(disabled);
        setDisabledLoaded(disabled);
      }
      setDraft(saved);
      onSaved(saved);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const current = TABS.find((t) => t.id === tab)!;
  const filteredSkills = skills.filter((s) => (s.name + s.description).toLowerCase().includes(skillQuery.toLowerCase()));

  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Seções das configurações">
        <button className="settings-back" onClick={onClose}><Icon name="left" size={15} /> Voltar</button>
        <div className="settings-nav-title">Configurações</div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </nav>

      <div className="settings-main">
        <div className="settings-content" key={tab}>
          <h2>{current.label}</h2>

          {tab === "geral" && (
            <>
              <label className="field"><span>Pasta de trabalho padrão</span>
                <input value={draft.workspace} onChange={(e) => setDraft({ ...draft, workspace: e.target.value })} />
                <small>O agente lê e escreve só dentro desta pasta, a menos que a conversa tenha uma pasta própria.</small>
              </label>
              <label className="field"><span>Modo de permissão padrão</span>
                <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode })}>
                  {(Object.keys(MODE_LABELS) as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                </select>
              </label>
            </>
          )}

          {tab === "modelos" && (
            <>
              <p className="lead">O modelo local roda dentro do Zenith, a partir de arquivos .gguf na pasta de modelos. Chaves de nuvem ficam cifradas neste computador.</p>
              <div className="row-list">
                <div>
                  <Icon name="folder" size={16} />
                  <div className="grow"><div className="row-title">Pasta de modelos</div><small className="ellipsis">{modelsDir || "…"}</small></div>
                  <button className="btn sm" onClick={() => api.modelsDir(true)}>Abrir</button>
                </div>
              </div>
              <div className="row-list">
                {draft.providers.map((p) => (
                  <div key={p.id} className="provider-row">
                    <button className={`switch ${p.enabled ? "on" : ""}`} onClick={() => updateProvider(p.id, { enabled: !p.enabled })} role="switch" aria-checked={p.enabled} aria-label={`Ativar ${p.name}`} />
                    <div className="grow">
                      <div className="row-title">{p.name}</div>
                      {p.kind === "native" ? (
                        <small>Roda neste computador, sem internet.</small>
                      ) : (
                        <div className="grid2 tight">
                          <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })} placeholder="URL base" aria-label={`URL de ${p.name}`} />
                          <input type="password" value={p.apiKey ?? ""} onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })} placeholder="Chave de API" aria-label={`Chave de ${p.name}`} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid2">
                <label className="field"><span>Provedor padrão</span>
                  <select value={draft.defaultProvider} onChange={(e) => setDraft({ ...draft, defaultProvider: e.target.value })}>
                    {draft.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="field"><span>Modelo padrão</span>
                  <input value={draft.defaultModel} onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })} placeholder="Qwen3-8B-Q4_K_M.gguf" />
                </label>
                <label className="field"><span>Estilo de resposta</span>
                  <select value={draft.responseStyle} onChange={(e) => setDraft({ ...draft, responseStyle: e.target.value as Settings["responseStyle"] })}>
                    <option value="normal">Equilibrado</option>
                    <option value="conciso">Conciso</option>
                    <option value="detalhado">Detalhado</option>
                    <option value="didatico">Didático</option>
                  </select>
                </label>
                <label className="field"><span>Máximo de tokens por resposta</span>
                  <input type="number" min={256} max={8192} step={256} value={draft.maxTokens} onChange={(e) => setDraft({ ...draft, maxTokens: Number(e.target.value) })} />
                </label>
                <label className="field"><span>Temperatura · {draft.temperature.toFixed(2)}</span>
                  <input type="range" min={0} max={2} step={0.05} value={draft.temperature} onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })} />
                  <small>Mais alto: respostas mais variadas. Mais baixo: mais previsíveis.</small>
                </label>
                <label className="field"><span>Top-p · {draft.topP.toFixed(2)}</span>
                  <input type="range" min={0.05} max={1} step={0.05} value={draft.topP} onChange={(e) => setDraft({ ...draft, topP: Number(e.target.value) })} />
                  <small>Limita as palavras consideradas a uma fatia de probabilidade.</small>
                </label>
              </div>
              <label className="field"><span>Instruções extras (somadas ao prompt de sistema)</span>
                <textarea rows={3} value={draft.customPrompt} onChange={(e) => setDraft({ ...draft, customPrompt: e.target.value })} placeholder="Ex.: Sempre responda com um exemplo de código." />
              </label>
            </>
          )}

          {tab === "agente" && (
            <>
              <p className="lead">Ações que mudam arquivos, rodam comandos ou acessam a rede pedem permissão, exceto nos modos que você escolher.</p>
              <div className="row-list">
                {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                  <div key={m} className="clickable" onClick={() => setDraft({ ...draft, mode: m })} role="radio" aria-checked={draft.mode === m} tabIndex={0}>
                    <span className={`radio ${draft.mode === m ? "on" : ""}`} />
                    <div className="grow"><div className="row-title">{MODE_LABELS[m]}</div><small>{{ ask: "Pede aprovação antes de editar arquivos ou rodar comandos.", accept_edits: "Edita arquivos sem perguntar; comandos ainda pedem aprovação.", plan: "Só lê e planeja. Não altera nada.", bypass: "Roda tudo sem perguntar. Use só em pastas descartáveis." }[m]}</small></div>
                  </div>
                ))}
              </div>
              <h3>Sempre permitir</h3>
              {draft.alwaysAllow.length === 0 ? <p className="hint">Nenhuma regra. Elas aparecem quando você escolhe “Sempre permitir” num pedido de aprovação.</p> : (
                <div className="row-list">
                  {draft.alwaysAllow.map((r) => (
                    <div key={r}><code className="grow">{r}</code><button className="icon-btn" onClick={() => setDraft({ ...draft, alwaysAllow: draft.alwaysAllow.filter((x) => x !== r) })} title="Remover regra" aria-label="Remover regra"><Icon name="trash" size={15} /></button></div>
                  ))}
                </div>
              )}
              <h3>Hooks</h3>
              <p className="hint">{Object.keys(hooks).length ? `Carregados de .zenith/hooks.json: ${Object.keys(hooks).join(", ")}.` : "Nenhum hook configurado. Crie .zenith/hooks.json na pasta de trabalho para rodar comandos em SessionStart, PreToolUse, PostToolUse ou Stop."}</p>
            </>
          )}

          {tab === "memoria" && (
            <>
              <p className="lead">Fatos e preferências que o modelo lembra em todas as conversas. Fica em .zenith/memoria.md.</p>
              <textarea rows={14} value={memory} onChange={(e) => setMemory(e.target.value)} className="full" placeholder="Ex.: Prefiro respostas curtas. Meu projeto usa TypeScript." aria-label="Memória" />
            </>
          )}

          {tab === "skills" && (
            <>
              <p className="lead">Skills são instruções em SKILL.md que o agente carrega quando a tarefa pede. Desligue as que não quer que o modelo veja. Use digitando / no compositor.</p>
              <div className="search-field"><Icon name="search" size={16} /><input value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} placeholder={`Procurar entre ${skills.length} skills`} aria-label="Procurar skills" /></div>
              <div className="row-list">
                {filteredSkills.length === 0 && <div><span className="hint">Nenhuma skill encontrada.</span></div>}
                {filteredSkills.map((s) => {
                  const on = !disabled.includes(s.name);
                  return (
                    <div key={s.name}>
                      <div className="grow"><div className="row-title">/{s.name}</div><small className="clamp2">{s.description}</small></div>
                      <button className={`switch ${on ? "on" : ""}`} onClick={() => setDisabled(on ? [...disabled, s.name] : disabled.filter((x) => x !== s.name))} role="switch" aria-checked={on} aria-label={`${on ? "Desligar" : "Ligar"} ${s.name}`} />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "plugins" && (
            <>
              <p className="lead">No Zenith, um plugin é um pacote de skills (pasta com SKILL.md) ou um servidor MCP. Tudo roda localmente.</p>
              <div className="grid">
                <div className="card">
                  <h3><span><Icon name="spark" size={16} /> Skills</span><span className="tag ok">{skills.length - disabled.length} ligadas</span></h3>
                  <p>Para instalar, copie a pasta da skill para <code>skills/</code> do app ou <code>.zenith/skills/</code> do projeto e reabra o Zenith.</p>
                  <div className="actions"><button className="btn sm" onClick={() => setTab("skills")}>Gerenciar skills</button></div>
                </div>
                <div className="card">
                  <h3><span><Icon name="plug" size={16} /> Servidores MCP</span><span className="tag ok">{mcp?.length ?? 0} configurados</span></h3>
                  <p>Para instalar, adicione o servidor em <code>.zenith/mcp.json</code> na pasta de trabalho.</p>
                  <div className="actions"><button className="btn sm" onClick={() => setTab("mcp")}>Ver servidores</button></div>
                </div>
              </div>
            </>
          )}

          {tab === "mcp" && (
            <>
              <p className="lead">Servidores MCP dão ferramentas extras ao agente. Configure em <code>.zenith/mcp.json</code> na pasta de trabalho.</p>
              {mcp === null && <p className="hint">Carregando…</p>}
              {mcp?.length === 0 && <pre className="code-sample">{`{\n  "servers": {\n    "meu-servidor": { "command": "node", "args": ["servidor.js"] }\n  }\n}`}</pre>}
              {mcp && mcp.length > 0 && (
                <div className="row-list">
                  {mcp.map((s) => (
                    <div key={s.name}>
                      <span className={`dot ${s.error ? "err" : "ok"}`} />
                      <div className="grow"><div className="row-title">{s.name}</div><small>{s.error ? s.error : `${s.tools.length} ferramenta(s): ${s.tools.slice(0, 6).join(", ")}${s.tools.length > 6 ? "…" : ""}`}</small></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "web" && (
            <label className="field"><span>Busca por SearXNG (opcional)</span>
              <input value={draft.searxngUrl} onChange={(e) => setDraft({ ...draft, searxngUrl: e.target.value })} placeholder="ex.: http://localhost:8080" />
              <small>Vazio usa as fontes públicas em ordem (DuckDuckGo, DuckDuckGo Lite, Bing e, por último, Wikipédia). Elas às vezes bloqueiam pedidos automáticos; um SearXNG local evita isso e mantém as buscas sob seu controle.</small>
            </label>
          )}
          {tab === "web" && (
            <>
              <h3>Como subir um SearXNG local (com Docker)</h3>
              <pre className="code-sample">docker run -d --name searxng -p 8080:8080 -e SEARXNG_BASE_URL=http://localhost:8080/ searxng/searxng</pre>
              <p className="hint">Depois ative o formato JSON em settings.yml do SearXNG (search: formats: [html, json]) e preencha o campo acima com http://localhost:8080.</p>
            </>
          )}

          {tab === "aparencia" && (
            <>
              <h3>Tema</h3>
              <div className="theme-pick">
                {(["claro", "escuro"] as const).map((t) => (
                  <button key={t} className={`theme-card ${t} ${theme === t ? "on" : ""}`} onClick={() => onTheme(t)} aria-pressed={theme === t}>
                    <span className="theme-preview"><span /><span /><span /></span>
                    {t === "claro" ? "Claro" : "Escuro"}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "idioma" && (
            <label className="field"><span>Idioma da interface</span>
              <select defaultValue="pt-BR"><option value="pt-BR">Português (Brasil)</option></select>
              <small>A interface está em português. O modelo responde no idioma em que você escrever.</small>
            </label>
          )}

          {tab === "atalhos" && (
            <div className="row-list">
              {SHORTCUTS.map(([a, k]) => (
                <div key={a}><div className="grow">{a}</div><kbd>{k}</kbd></div>
              ))}
            </div>
          )}

          {tab === "voz" && (
            <>
              <p className="lead">O botão de alto-falante nas respostas lê o texto com as vozes instaladas no Windows, sem internet.</p>
              <label className="field"><span>Voz de leitura</span>
                <select value={voice} onChange={(e) => { setVoice(e.target.value); localStorage.setItem("zenith-voice", e.target.value); }}>
                  <option value="">Padrão do sistema (português, se houver)</option>
                  {voices.filter((v) => v.localService).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
                </select>
              </label>
              <label className="field"><span>Velocidade · {rate.toFixed(1)}x</span>
                <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => { setRate(Number(e.target.value)); localStorage.setItem("zenith-rate", e.target.value); }} />
              </label>
              <button className="btn sm" onClick={() => {
                const u = new SpeechSynthesisUtterance("Olá, eu sou o Zenith. Esta é a voz de leitura.");
                const v = voices.find((x) => x.voiceURI === voice);
                if (v) u.voice = v;
                u.lang = v?.lang ?? "pt-BR";
                u.rate = rate;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
              }}><Icon name="speaker" size={14} /> Testar voz</button>
              <p className="hint">Ditado por voz precisa de um transcritor local (ex.: whisper.cpp) e ainda não está disponível.</p>
            </>
          )}

          {tab === "dados" && (
            <>
              <p className="lead">Conversas, configurações e memória ficam neste computador, em .zenith-data/ e na pasta de trabalho. Nada é enviado a servidores do Zenith.</p>
              <div className="row-list">
                <div><div className="grow"><div className="row-title">Exportar todas as conversas</div><small>Um arquivo JSON com conversas e mensagens.</small></div><a className="btn sm" href={api.exportAllUrl} download>Exportar</a></div>
              </div>
            </>
          )}

          {tab === "sobre" && (
            <>
              <p className="lead">Zenith Code 1.0 · assistente local com modelos nativos, agente de código, skills e MCP. Sem conta e sem telemetria.</p>
            </>
          )}

          {error && <div className="error">{error}</div>}
        </div>

        <div className={`save-bar ${dirty ? "dirty" : ""}`}>
          <span className="muted small">{dirty ? "Alterações não salvas" : savedAt ? "Salvo" : "Sem alterações"}</span>
          <button className="btn ghost" onClick={() => { setDraft(settings); setMemory(memoryLoaded); setDisabled(disabledLoaded); }} disabled={!dirty || saving}>Descartar</button>
          <button className="btn primary" onClick={save} disabled={!dirty || saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
