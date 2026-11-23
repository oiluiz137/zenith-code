// Compila o servidor (TypeScript) num único arquivo ESM em dist-server/, para o app instalado
// rodar só com node.exe, sem tsx. O node-llama-cpp fica de fora (tem binários nativos).
import { build } from "esbuild";

await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist-server/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["node-llama-cpp"],
  banner: { js: "import { createRequire as __zenithRequire } from 'node:module'; const require = __zenithRequire(import.meta.url);" },
  logLevel: "warning",
});
console.log("dist-server/index.mjs pronto");
