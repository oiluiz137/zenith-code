import { useEffect, useState } from "react";
import { api, type Project } from "../api";
import { Icon } from "./Icons";
import { askConfirm } from "./Dialogs";

interface Props {
  project: Project;
  onChanged: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

/** Projeto: instruções próprias e arquivos de referência usados nas conversas do projeto. */
export function ProjectModal({ project, onChanged, onDeleted, onClose }: Props) {
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const [folder, setFolder] = useState(project.folder ?? "");
  const [picking, setPicking] = useState(false);
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [error, setError] = useState("");

  const loadFiles = () => api.projectFiles(project.id).then(setFiles).catch((e) => setError((e as Error).message));
  useEffect(() => {
    loadFiles();
  }, [project.id]);

  async function save() {
    try {
      await api.updateProject(project.id, { name, instructions, folder: folder.trim() || null });
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pickFolder() {
    setPicking(true);
    setError("");
    try {
      const r = await api.pickFolder();
      if (r.path) setFolder(r.path);
      else if (r.error) setError(`Não foi possível abrir o seletor (${r.error}). Digite o caminho no campo.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPicking(false);
    }
  }

  async function upload(file: File) {
    const text = await file.text();
    try {
      await api.addProjectFile(project.id, file.name, text);
      await loadFiles();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeFile(id: string) {
    await api.deleteProjectFile(id);
    await loadFiles();
  }

  async function remove() {
    if (!(await askConfirm({ title: "Excluir projeto", message: `Excluir "${project.name}"? As conversas são mantidas, sem projeto.`, confirm: "Excluir", danger: true }))) return;
    await api.deleteProject(project.id);
    onDeleted();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>Projeto</strong><span className="spacer" />
          <button className="icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar"><Icon name="x" size={16} /></button>
        </header>
        <div className="modal-body">
        <section>
          <label className="field">
            <span>Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span>Pasta de trabalho</span>
            <div className="folder-row">
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="ex.: E:\projetos\meu-app" aria-label="Pasta de trabalho do projeto" spellCheck={false} />
              <button className="btn sm" onClick={pickFolder} disabled={picking}><Icon name="folder" size={14} /> {picking ? "Aguardando…" : "Escolher…"}</button>
            </div>
            <small>Conversas do projeto leem e escrevem nesta pasta. {picking && "O seletor de pastas abriu numa janela do Windows."}</small>
          </div>
          <label className="field">
            <span>Instruções do projeto</span>
            <textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </label>
        </section>
        <section>
          <h3>Arquivos de referência</h3>
          <p className="hint">Arquivos de texto (md, txt, código, csv, json). O app envia ao modelo os trechos mais relevantes para cada pergunta.</p>
          <label className="btn sm file-btn"><Icon name="clip" size={14} /> Adicionar arquivo<input type="file" hidden accept=".md,.txt,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yml,.yaml,.xml,.log" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ""; }} /></label>
          <ul className="plain">
            {files.map((f) => (
              <li key={f.id}>
                {f.name} <span className="hint">({Math.round(f.size / 1024)} KB)</span>{" "}
                <button className="link" onClick={() => removeFile(f.id)}>remover</button>
              </li>
            ))}
            {files.length === 0 && <li className="hint">Nenhum arquivo.</li>}
          </ul>
        </section>
        {error && <div className="error">{error}</div>}
        </div>
        <footer>
          <button className="btn danger" onClick={remove}>Excluir projeto</button><span className="spacer" />
          <button className="btn primary" onClick={save}>Salvar</button>
        </footer>
      </div>
    </div>
  );
}
