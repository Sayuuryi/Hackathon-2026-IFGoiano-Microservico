import type { Game, Kind } from "./types";
export const recipes: Record<string, { name: string; items: string[] }> = {
  soup: {
    name: "Sopinha do aconchego",
    items: ["carrot", "potato", "pumpkin"],
  },
  cookies: {
    name: "Biscoitinhos de carinho",
    items: ["flour", "oats", "banana"],
  },
};
export const trails: Record<string, { name: string; items: string[] }> = {
  "park-lake": { name: "Caminho da lagoa", items: ["bird", "water", "bench"] },
  "park-flowers": {
    name: "Trilha das flores",
    items: ["flower", "butterfly", "tree"],
  },
};
export const labels: Record<string, string> = {
  carrot: "Cenoura",
  potato: "Batata",
  pumpkin: "Abóbora",
  flour: "Farinha",
  oats: "Aveia",
  banana: "Banana",
  bird: "Ouvir o passarinho",
  water: "Reparar na água",
  bench: "Sentar no banco",
  flower: "Encontrar uma flor",
  butterfly: "Acompanhar a borboleta",
  tree: "Descansar à sombra",
  sunfish: "Peixinho do sol",
  moonfish: "Peixinho da lua",
  mintfish: "Peixinho de hortelã",
  coralfish: "Peixinho coral",
  rest: "Uma pausa juntos",
  soup: "Sopinha do aconchego",
  cookies: "Biscoitinhos de carinho",
  "park-lake": "Caminho da lagoa",
  "park-flowers": "Trilha das flores",
};
export function startLocal(kind: Kind, definitionId: string): Game {
  return {
    id: crypto.randomUUID(),
    kind,
    definitionId,
    state:
      kind === "fishing"
        ? "WAITING"
        : kind === "cooking"
          ? "INGREDIENTS"
          : "WALKING",
    progress: 0,
    selected: [],
    readyAt: kind === "fishing" ? Date.now() + 35000 : 0,
    resultId: null,
    version: 0,
    local: true,
  };
}
export function actLocal(previous: Game, action: string, value = ""): Game {
  const g = {
    ...previous,
    selected: [...previous.selected],
    local: true,
    version: previous.version + 1,
  };
  if (g.state === "FINISHED")
    throw Error("Esse momento já terminou. Podemos começar outro.");
  if (g.kind === "fishing" && action === "catch" && Date.now() >= g.readyAt) {
    g.state = "FINISHED";
    g.resultId = ["sunfish", "moonfish", "mintfish", "coralfish"][
      crypto.getRandomValues(new Uint32Array(1))[0] % 4
    ];
    return g;
  }
  if (g.kind === "cooking") {
    if (
      g.state === "INGREDIENTS" &&
      action === "ingredient" &&
      recipes[g.definitionId].items.includes(value) &&
      !g.selected.includes(value)
    ) {
      g.selected.push(value);
      g.progress++;
      if (g.progress === 3) {
        g.state = "MIXING";
        g.progress = 0;
      }
      return g;
    }
    if (g.state === "MIXING" && action === "mix") {
      g.progress++;
      if (g.progress === 3) {
        g.state = "COOKING";
        g.readyAt = Date.now() + 12000;
      }
      return g;
    }
    if (
      g.state === "COOKING" &&
      action === "finish" &&
      Date.now() >= g.readyAt
    ) {
      g.state = "FINISHED";
      g.resultId = g.definitionId;
      return g;
    }
  }
  if (
    g.kind === "park" &&
    action === "observe" &&
    value === trails[g.definitionId].items[g.progress]
  ) {
    g.selected.push(value);
    g.progress++;
    if (g.progress === 3) {
      g.state = "FINISHED";
      g.resultId = g.definitionId;
    }
    return g;
  }
  throw Error(
    g.state === "INGREDIENTS"
      ? "Esse ingrediente fica para outra receita. Vamos escolher um da nossa listinha?"
      : "Vamos com calma. Ainda estamos nesta etapa.",
  );
}
