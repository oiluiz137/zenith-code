// Fila de pedidos de permissão. Cada pedido fica pendente até o usuário decidir na interface.
export type Decision = "once" | "always" | "deny";

const pending = new Map<string, (d: Decision) => void>();

export function requestPermission(id: string, signal: AbortSignal): Promise<Decision> {
  return new Promise((resolve) => {
    const finish = (d: Decision) => {
      pending.delete(id);
      resolve(d);
    };
    pending.set(id, finish);
    signal.addEventListener("abort", () => finish("deny"), { once: true });
  });
}

export function resolvePermission(id: string, decision: Decision): boolean {
  const fn = pending.get(id);
  if (!fn) return false;
  fn(decision);
  return true;
}
