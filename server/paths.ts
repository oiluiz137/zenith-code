// Caminhos do Zenith. Em desenvolvimento tudo fica na pasta do projeto.
// No app instalado, o "Zenith Code.exe" define ZENITH_HOME (ex.: %LOCALAPPDATA%\Zenith Code)
// para que dados, modelos e a pasta de trabalho fiquem fora da pasta do programa.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Pasta do programa: contém dist/ (interface) e skills/. O servidor fica em server/ ou dist-server/. */
export const APP_ROOT = process.env.ZENITH_APP_ROOT ?? path.resolve(here, "..");

/** Pasta dos dados do usuário. */
export const HOME = process.env.ZENITH_HOME ?? process.cwd();

export const DATA_DIR = path.join(HOME, ".zenith-data");
export const MODELS_DIR = process.env.ZENITH_MODELS ?? path.join(HOME, "models");
export const DEFAULT_WORKSPACE = path.join(HOME, "workspace");
export const BUNDLED_SKILLS = path.join(APP_ROOT, "skills");

for (const dir of [DATA_DIR, MODELS_DIR, DEFAULT_WORKSPACE]) fs.mkdirSync(dir, { recursive: true });
