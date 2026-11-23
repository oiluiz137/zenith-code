// Diferença por linhas entre duas versões de um arquivo, agrupada em trechos.
// Usada para revisar as edições do agente e reverter trechos escolhidos.

export type Op = { type: "eq" | "del" | "add"; line: string };

export interface Hunk {
  /** Índice do trecho (0, 1, 2…), usado para escolher quais reverter. */
  index: number;
  /** Linha inicial (1-based) na versão anterior e na nova. */
  oldStart: number;
  newStart: number;
  /** Linhas do trecho com contexto: prefixo " ", "-" ou "+". */
  lines: string[];
}

const MAX_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

/** Diferença mínima por linhas (LCS). Arquivos enormes viram "tudo removido, tudo adicionado". */
export function lineDiff(before: string, after: string): Op[] {
  const a = splitLines(before);
  const b = splitLines(after);
  // Prefixo e sufixo iguais saem do cálculo pesado.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head: Op[] = a.slice(0, start).map((line) => ({ type: "eq", line }));
  const tail: Op[] = a.slice(endA).map((line) => ({ type: "eq", line }));
  const ma = a.slice(start, endA);
  const mb = b.slice(start, endB);
  const n = ma.length;
  const m = mb.length;
  let middle: Op[];
  if (n * m > MAX_CELLS) {
    middle = [...ma.map((line) => ({ type: "del" as const, line })), ...mb.map((line) => ({ type: "add" as const, line }))];
  } else {
    // dp[i][j] = tamanho da LCS de ma[i:] e mb[j:]
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = ma[i] === mb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    middle = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (ma[i] === mb[j]) {
        middle.push({ type: "eq", line: ma[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        middle.push({ type: "del", line: ma[i++] });
      } else {
        middle.push({ type: "add", line: mb[j++] });
      }
    }
    while (i < n) middle.push({ type: "del", line: ma[i++] });
    while (j < m) middle.push({ type: "add", line: mb[j++] });
  }
  return [...head, ...middle, ...tail];
}

/** Agrupa as mudanças em trechos com `context` linhas iguais em volta. */
export function toHunks(ops: Op[], context = 3): Hunk[] {
  const hunks: Hunk[] = [];
  let oldLine = 1;
  let newLine = 1;
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === "eq") {
      oldLine++;
      newLine++;
      i++;
      continue;
    }
    // Começo de uma mudança: volta até `context` linhas iguais.
    const ctxStart = Math.max(0, i - context);
    const back = i - ctxStart;
    const oStart = oldLine - back;
    const nStart = newLine - back;
    const lines: string[] = ops.slice(ctxStart, i).map((o) => ` ${o.line}`);
    // Junta mudanças separadas por poucas linhas iguais no mesmo trecho.
    while (i < ops.length) {
      if (ops[i].type !== "eq") {
        const o = ops[i];
        lines.push(`${o.type === "del" ? "-" : "+"}${o.line}`);
        if (o.type === "del") oldLine++;
        else newLine++;
        i++;
        continue;
      }
      let run = 0;
      while (i + run < ops.length && ops[i + run].type === "eq") run++;
      const atEnd = i + run >= ops.length;
      if (!atEnd && run <= context * 2) {
        for (let k = 0; k < run; k++) lines.push(` ${ops[i + k].line}`);
        oldLine += run;
        newLine += run;
        i += run;
        continue;
      }
      const keep = Math.min(run, context);
      for (let k = 0; k < keep; k++) lines.push(` ${ops[i + k].line}`);
      break;
    }
    hunks.push({ index: hunks.length, oldStart: oStart, newStart: nStart, lines });
  }
  return hunks;
}

/**
 * Monta o texto final mantendo a versão nova, exceto nos trechos escolhidos,
 * que voltam à versão anterior.
 */
export function revertHunks(before: string, after: string, revert: number[]): string {
  const ops = lineDiff(before, after);
  const chosen = new Set(revert);
  const out: string[] = [];
  let hunk = -1;
  let inChange = false;
  let i = 0;
  // Um trecho para a reversão = sequência de mudanças separada por no máximo 6 linhas iguais
  // (a mesma regra de toHunks com contexto 3).
  while (i < ops.length) {
    const o = ops[i];
    if (o.type === "eq") {
      let run = 0;
      while (i + run < ops.length && ops[i + run].type === "eq") run++;
      const atEnd = i + run >= ops.length;
      if (inChange && (atEnd || run > 6)) inChange = false;
      for (let k = 0; k < run; k++) out.push(ops[i + k].line);
      i += run;
      continue;
    }
    if (!inChange) {
      hunk++;
      inChange = true;
    }
    const back = chosen.has(hunk);
    if (o.type === "del" && back) out.push(o.line);
    if (o.type === "add" && !back) out.push(o.line);
    i++;
  }
  return out.join("\n");
}
