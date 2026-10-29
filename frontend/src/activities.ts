import type { Kind } from "./types";
import { probeJson } from "./connectivity";
import { tryServiceAgain } from "./api";
export const kinds: Kind[] = ["fishing", "cooking", "park"];
export const closures: Record<Kind, { title: string; detail: string }> = {
  fishing: {
    title: "O lago está fechado para cuidar da margem.",
    detail:
      "O serviço de pesca está indisponível. Vamos deixar as águas descansarem um pouquinho?",
  },
  cooking: {
    title: "A cozinha está fechada para arrumação.",
    detail:
      "O serviço da cozinha está indisponível. Estamos guardando os ingredientes para a próxima receita.",
  },
  park: {
    title: "O parque está fechado para limpeza.",
    detail:
      "O serviço do parque está indisponível. Assim que o caminho estiver livre, a gente passeia de novo.",
  },
};
export type Availability = {
  state: "checking" | "online" | "offline";
  checkedAt: number;
  status?: number;
  code?: string;
};
const definitionIds: Record<Kind, string[]> = {
  fishing: ["lake"],
  cooking: ["soup", "cookies"],
  park: ["park-lake", "park-flowers"],
};
export function acceptsCatalog(kind: Kind, body: any): boolean {
  return (
    Array.isArray(body?.items) &&
    definitionIds[kind].every((id) =>
      body.items.some(
        (item: any) =>
          item?.id === id &&
          typeof item.name === "string" &&
          Array.isArray(item.items),
      ),
    )
  );
}
export class ActivityMonitor {
  private states = Object.fromEntries(
    kinds.map((k) => [k, { state: "checking", checkedAt: 0 }]),
  ) as Record<Kind, Availability>;
  private listeners = new Set<() => void>();
  private pending = new Map<Kind, Promise<boolean>>();
  private revisions: Record<Kind, number> = { fishing: 0, cooking: 0, park: 0 };
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  snapshot = () => this.states;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(
    kind: Kind,
    state: Availability["state"],
    detail: Partial<Availability> = {},
  ) {
    this.states = {
      ...this.states,
      [kind]: { state, checkedAt: Date.now(), ...detail },
    };
    for (const l of this.listeners) l();
  }
  offline = (kind: Kind) => {
    this.revisions[kind]++;
    this.set(kind, "offline", { code: "ACTION_FAILED" });
  };
  check = (kind: Kind): Promise<boolean> => {
    const previous = this.pending.get(kind);
    if (previous) return previous;
    const revision = this.revisions[kind];
    const task = (async () => {
      // This route exists in every released backend and exercises the game's own DB.
      // No session cookies: an expired login cannot close a healthy destination.
      const result = await probeJson(
        "/api/games/" + kind + "/catalog",
        (body) => acceptsCatalog(kind, body),
        this.fetcher,
      );
      if (this.revisions[kind] === revision) {
        if (result.online) tryServiceAgain("/api/games/" + kind);
        this.set(kind, result.online ? "online" : "offline", {
          status: result.status,
          code: result.code,
        });
      }
      return this.states[kind].state === "online";
    })().finally(() => this.pending.delete(kind));
    this.pending.set(kind, task);
    return task;
  };
  checkAll = () => Promise.all(kinds.map((k) => this.check(k)));
}
export function isActivity(value: string): value is Kind {
  return kinds.includes(value as Kind);
}
