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
