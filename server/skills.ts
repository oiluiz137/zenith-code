// Skills no formato SKILL.md: pasta com um arquivo SKILL.md (frontmatter com name e description) e recursos opcionais.
// Procuradas em <workspace>/.zenith/skills/ e em <app>/skills/.
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_SKILLS } from "./paths.ts";

export interface Skill {
  name: string;
  description: string;
  body: string;
  dir: string;
}

export function loadSkills(workspace: string): Skill[] {
  const roots = [path.join(workspace, ".zenith", "skills"), BUNDLED_SKILLS];
  const found: Skill[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, entry.name, "SKILL.md");
      if (!fs.existsSync(file)) continue;
      const skill = parseSkill(fs.readFileSync(file, "utf8"), path.join(root, entry.name));
      if (skill && !found.some((s) => s.name === skill.name)) found.push(skill);
    }
  }
  return found;
}

export function parseSkill(text: string, dir: string): Skill | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.name || !meta.description) return null;
  return { name: meta.name, description: meta.description, body: match[2].trim(), dir };
}

export function skillsIndex(skills: Skill[]): string {
  if (!skills.length) return "Nenhuma skill instalada.";
  return skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
}

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function validSkillName(name: string): boolean {
  return NAME_RE.test(name);
}

/** Pasta de uma skill do projeto (editável): <workspace>/.zenith/skills/<nome>. */
export function projectSkillDir(workspace: string, name: string): string {
  return path.join(workspace, ".zenith", "skills", name);
}

/** Texto completo do SKILL.md e de onde ele vem ("projeto" = editável, "app" = vem com o Zenith). */
export function readSkillFile(workspace: string, name: string): { content: string; origin: "projeto" | "app" } | null {
  for (const [dir, origin] of [[projectSkillDir(workspace, name), "projeto"], [path.join(BUNDLED_SKILLS, name), "app"]] as const) {
    const file = path.join(dir, "SKILL.md");
    if (validSkillName(name) && fs.existsSync(file)) return { content: fs.readFileSync(file, "utf8"), origin };
  }
  return null;
}

/** Grava a skill no projeto (cria ou substitui). Retorna uma mensagem de erro se o texto não for uma skill válida. */
export function writeProjectSkill(workspace: string, name: string, content: string): string | null {
  if (!validSkillName(name)) return "Nome inválido: use letras minúsculas, números e hífens (ex.: revisar-codigo).";
  const skill = parseSkill(content, "");
  if (!skill) return "O texto precisa começar com um bloco --- com name: e description: e depois as instruções.";
  if (skill.name !== name) return `O campo name (${skill.name}) precisa ser igual ao nome da skill (${name}).`;
  const dir = projectSkillDir(workspace, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), content, "utf8");
  return null;
}

export function deleteProjectSkill(workspace: string, name: string): boolean {
  const dir = projectSkillDir(workspace, name);
  if (!validSkillName(name) || !fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}