import { useEffect, useState } from "react";
import { api, type Project } from "../api";
import { Icon } from "./Icons";

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
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [error, setError] = useState("");

  const loadFiles = () => api.projectFiles(project.id).then(setFiles).catch((e) => setError((e as Error).message));
  useEffect(() => {
    loadFiles();
  }, [project.id]);

  async function save() {
    try {
      await api.updateProject(project.id, { name, instructions });
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
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
    if (!window.confirm(`Excluir o projeto "${project.name}"? As conversas são mantidas, sem projeto.`)) return;
    await api.deleteProject(project.id);
    onDeleted();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>Projeto</strong>
          <button className="icon-btn" onClick={onClose} title="Fechar" aria-label="Fechar"><Icon name="x" size={16} /></button>
        </header>
        <div className="modal-body">
        <section>
          <label className="field">
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Instruções do projeto (entram no contexto de todas as conversas dele)
            <textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </label>
        </section>
        <section>
          <h3>Arquivos de referência</h3>
          <p className="hint">Arquivos de texto (md, txt, código, csv, json). O app envia ao modelo os trechos mais relevantes para cada pergunta.</p>
          <input type="file" accept=".md,.txt,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yml,.yaml,.xml,.log" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
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
