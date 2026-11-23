// Guarda chaves de API cifradas com o cofre do Windows (DPAPI, escopo do usuário atual).
// Fora do Windows, a chave fica como está e o app avisa na tela de Configurações.
import { execFileSync } from "node:child_process";

const PREFIX = "dpapi:";
const cache = new Map<string, string>();

export const SECRETS_SUPPORTED = process.platform === "win32";

function runPs(script: string, input: string): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, ZENITH_INPUT: input },
    encoding: "utf8",
    windowsHide: true,
    timeout: 20_000,
  }).trim();
}

/** Cifra uma chave. Retorna "dpapi:<base64>" no Windows, ou o texto original em outros sistemas. */
export function protectSecret(plain: string): string {
  if (!plain || plain.startsWith(PREFIX) || !SECRETS_SUPPORTED) return plain;
  const script = "Add-Type -AssemblyName System.Security; $b=[Text.Encoding]::UTF8.GetBytes($env:ZENITH_INPUT); $o=[Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'); [Convert]::ToBase64String($o)";
  const b64 = runPs(script, plain);
  return PREFIX + b64;
}

/** Decifra uma chave guardada. Valores sem o prefixo são devolvidos como estão. */
export function revealSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const cached = cache.get(stored);
  if (cached !== undefined) return cached;
  const script = "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:ZENITH_INPUT); $o=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'); [Text.Encoding]::UTF8.GetString($o)";
  const plain = runPs(script, stored.slice(PREFIX.length));
  cache.set(stored, plain);
  return plain;
}

export function isProtected(stored: string | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}
