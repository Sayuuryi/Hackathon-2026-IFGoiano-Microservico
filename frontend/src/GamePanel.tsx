import { useEffect, useRef, useState } from "react";
import { api, ApiError, tryServiceAgain } from "./api";
import { recipes, trails, labels, startLocal, actLocal } from "./local-games";
import type { Game, Kind } from "./types";
import type { Availability } from "./activities";
import { Unavailable } from "./Unavailable";
export function GamePanel({
  kind,
  owner,
  guest,
  onNarrate,
  onGame,
  onMemory,
  onIntent,
  onBack,
  availability,
  onOffline,
  onRetry,
}: {
  availability: Availability;
  onOffline: () => void;
  onRetry: () => Promise<boolean>;
  kind: Kind;
  owner: string;
  guest: boolean;
  onNarrate: (s: string) => void;
  onGame: (g: Game | null) => void;
  onMemory: (kind: string) => void;
  onIntent: () => void;
  onBack: () => void;
}) {
  const storage = "ninho-game|" + owner + "|" + kind;
  const [game, setGame] = useState<Game | null>(() => {
      try {
        return JSON.parse(localStorage.getItem(storage) || "null");
      } catch {
        return null;
      }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [now, setNow] = useState(Date.now());
  const locked = useRef(false),
    active = useRef(true);
  const unavailable = availability.state !== "online";
  const [recovering, setRecovering] = useState(!!game && !game.local);
  function setUnavailable(value: boolean) {
    if (value) onOffline();
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      onGame(null);
    };
  }, []);
  useEffect(() => {
    onGame(game);
    if (game) localStorage.setItem(storage, JSON.stringify(game));
    else localStorage.removeItem(storage);
  }, [game]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  async function begin(definitionId: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    onIntent();
    let g: Game;
    try {
      if (guest) g = startLocal(kind, definitionId);
      else
        g = await api("/api/games/" + kind + "/sessions", "POST", {
          id: crypto.randomUUID(),
          definitionId,
        });
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) setError(e.message);
      else setUnavailable(true);
      setBusy(false);
      locked.current = false;
      return;
    }
    if (active.current) {
      setGame(g);
      onNarrate(
        kind === "fishing"
          ? "A linha está na água. Enquanto a gente espera, me conta: como foi seu dia?"
          : kind === "cooking"
            ? "Uma receita e um papo sem pressa. Vamos separar nossos ingredientes?"
            : "Vamos devagar. Quero reparar nas pequenas coisas com você.",
      );
    }
    locked.current = false;
    setBusy(false);
  }
  async function action(action: string, value = "", automatic = false) {
    if (!game || locked.current || unavailable || recovering) return;
    locked.current = true;
    setBusy(true);
    setError("");
    if (!automatic) onIntent();
    let next: Game | undefined;
    try {
      next = game.local
        ? actLocal(game, action, value)
        : await api<Game>(
            "/api/games/" + kind + "/sessions/" + game.id + "/actions",
            "POST",
            {
              requestId: crypto.randomUUID(),
              version: game.version,
              action,
              value,
            },
          );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        try {
          next = await api("/api/games/" + kind + "/sessions/" + game.id);
        } catch {
          setUnavailable(true);
        }
        setError(e.message);
      } else if (!(e instanceof ApiError) || e.status < 500)
        setError((e as Error).message);
      else setUnavailable(true);
    }
    if (active.current && next) {
      setGame(next);
      if (next.state === "COOKING" && game.state !== "COOKING")
        onNarrate(
          "Agora é esperar um pouquinho. O que você gostaria de me contar enquanto fica pronto?",
        );
      if (next.state === "FINISHED" && game.state !== "FINISHED")
        onNarrate(
          kind === "fishing"
            ? "Olha o nosso " +
                labels[next.resultId || ""] +
                "! Quer guardar esse encontro?"
            : kind === "cooking"
              ? "Ficou pronto! Gostei de preparar isso com você. Quer guardar no nosso álbum?"
              : "Chegamos. Foi bom dividir esse caminho com você. Qual pedacinho você mais gostou?",
        );
      if (kind === "park" && next.state !== "FINISHED")
        onNarrate(
          (
            {
              bird: "Tem um passarinho cantando bem ali. Que som te faz sentir em casa?",
              water:
                "A água está bem tranquila. Quer me contar o que passou pela sua cabeça?",
              flower:
                "Achei uma flor pequenininha. O que chamou sua atenção hoje?",
              butterfly:
                "A borboleta foi por ali. Vamos ficar mais um pouquinho por aqui?",
            } as Record<string, string>
          )[value],
        );
    }
    locked.current = false;
    setBusy(false);
  }
  useEffect(() => {
    if (
      game?.state === "COOKING" &&
      now >= game.readyAt &&
      !busy &&
      !unavailable &&
      !recovering
    )
      void action("finish", "", true);
  }, [now]);
  useEffect(() => {
    let live = true;
    if (unavailable) {
      setRecovering(true);
      return;
    }
    if (!game || game.local) {
      setRecovering(false);
      return;
    }
    setRecovering(true);
    tryServiceAgain("/api/games/" + kind);
    api<Game>("/api/games/" + kind + "/sessions/" + game.id)
      .then((g) => {
        if (live) setGame(g);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setGame(null);
        else if (e instanceof ApiError && e.status >= 500) onOffline();
        else setError(e.message);
      })
      .finally(() => {
        if (live) setRecovering(false);
      });
    return () => {
      live = false;
    };
  }, [availability.state]);
  const remaining = game
    ? Math.max(0, Math.ceil((game.readyAt - now) / 1000))
    : 0;
  const choose = () => {
    setGame(null);
    setSaved(false);
    setError("");
    tryServiceAgain("/api/games/" + kind);
  };
  if (unavailable)
    return (
      <Unavailable
        place={
          { fishing: "O lago", cooking: "A cozinha", park: "O parque" }[kind]
        }
        back={onBack}
        kind={kind}
        retry={onRetry}
      />
    );
  if (recovering)
    return (
      <div className="game-panel" role="status">
        <p>Reabrindo nosso caminho e recuperando a última etapa…</p>
        <button onClick={onBack}>Voltar ao ninho</button>
      </div>
    );
  return (
    <div className="game-panel">
      <p role="alert" className="error">
        {error}
      </p>
      {game?.local && (
        <p className="local-note">Atividade de apresentação neste aparelho.</p>
      )}
      {!game ? (
        <>
          <h3>
            {kind === "fishing"
              ? "O lago está uma calmaria."
              : kind === "cooking"
                ? "O que a gente prepara hoje?"
                : "Por onde vamos?"}
          </h3>
          <div className="choices">
            {kind === "fishing" ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => begin("lake")}
              >
                Lançar a linha
              </button>
            ) : (
              Object.entries(kind === "cooking" ? recipes : trails).map(
                ([id, r]) => (
                  <button key={id} disabled={busy} onClick={() => begin(id)}>
                    {r.name}
                  </button>
                ),
              )
            )}
          </div>
        </>
      ) : (
        <>
          {game.state === "WAITING" && (
            <>
              <p>
                {remaining
                  ? "A boia está quietinha. Nosso papo continua."
                  : "Opa, a boia mexeu! O peixe pode esperar você."}
              </p>
              <button
                className="primary"
                disabled={busy || remaining > 0}
                onClick={() => action("catch")}
              >
                {remaining ? "Esperando a fisgada…" : "Recolher a linha"}
              </button>
            </>
          )}
          {game.state === "INGREDIENTS" && (
            <>
              <h3>{recipes[game.definitionId].name}</h3>
              <p>
                Vamos separar:{" "}
                {recipes[game.definitionId].items
                  .map((i) => labels[i])
                  .join(", ")}
                .
              </p>
              <div className="choices">
                {[
                  ...recipes[game.definitionId].items,
                  ...(game.definitionId === "soup"
                    ? ["flour", "banana"]
                    : ["carrot", "potato"]),
                ].map((i) => (
                  <button
                    key={i}
                    aria-pressed={game.selected.includes(i)}
                    disabled={busy || game.selected.includes(i)}
                    onClick={() => action("ingredient", i)}
                  >
                    {labels[i]}
                  </button>
                ))}
              </div>
              <small>{game.progress} de 3 ingredientes</small>
            </>
          )}
          {game.state === "MIXING" && (
            <>
              <p>Uma voltinha de cada vez. {game.progress} de 3.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => action("mix")}
              >
                Misturar com carinho
              </button>
            </>
          )}
          {game.state === "COOKING" && (
            <>
              <p>Está quase pronto. A gente pode conversar enquanto espera.</p>
              <progress
                max={12}
                value={12 - remaining}
                aria-label="Tempo de preparo"
              />
              <small>
                {remaining
                  ? remaining + " segundos para ficar pronto"
                  : "Só mais um instante…"}
              </small>
            </>
          )}
          {game.state === "WALKING" && (
            <>
              <h3>{trails[game.definitionId].name}</h3>
              <p>Uma descoberta de cada vez. {game.progress} de 3.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  action(
                    "observe",
                    trails[game.definitionId].items[game.progress],
                  )
                }
              >
                {labels[trails[game.definitionId].items[game.progress]]}
              </button>
            </>
          )}
          {game.state === "FINISHED" && (
            <>
              <h3>{labels[game.resultId || ""]} ♡</h3>
              {!saved ? (
                <>
                  <p>Esse momento pode virar lembrança. Você escolhe.</p>
                  <div className="choices">
                    <button
                      className="primary"
                      onClick={() => {
                        onMemory(game.resultId!);
                        setSaved(true);
                        onIntent();
                      }}
                    >
                      Guardar no álbum
                    </button>
                    <button
                      onClick={() => {
                        setSaved(true);
                        onIntent();
                      }}
                    >
                      Só aproveitar o momento
                    </button>
                  </div>
                </>
              ) : (
                <p>Foi bom dividir esse tempinho com você.</p>
              )}
            </>
          )}
          <button className="quiet" disabled={busy} onClick={choose}>
            {game.state === "FINISHED"
              ? "Outra pequena aventura"
              : "Escolher outra atividade"}
          </button>
        </>
      )}
    </div>
  );
}
