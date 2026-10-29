import React, { Component, useEffect, useRef, useState } from "react";
import { api, restoreSession, tryServiceAgain } from "./api";
import { Auth, Customizer } from "./Auth";
import { Art } from "./Art";
import { useActivities } from "./useActivities";
import { isActivity, closures } from "./activities";
import { GamePanel } from "./GamePanel";
import { LocalAI } from "./LocalAI";
import { localAI, stopAI } from "./ai-client";
import { People } from "./People";
import { Unavailable } from "./Unavailable";
import { labels } from "./local-games";
import {
  baseProfile,
  type Game,
  type Kind,
  type Memory,
  type Message,
  type Profile,
  type Session,
} from "./types";
import "./palette.css";
import "./styles.css";
class Boundary extends Component<
  { children: React.ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Unavailable
        place={this.props.name}
        retry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    );
  }
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = box.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={box}
      onCancel={close}
      onClick={(e) => {
        if (e.target === box.current) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Fechar janela" onClick={close}>
          ×
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [guest, setGuest] = useState(false),
    [offline, setOffline] = useState(false),
    [modal, setModal] = useState(""),
    [profile, setProfile] = useState(baseProfile),
    [draft, setDraft] = useState(baseProfile),
    [scene, setScene] = useState("room"),
    [game, setGame] = useState<Game | null>(null),
    [care, setCare] = useState(false),
    [text, setText] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [aiReady, setAiReady] = useState(false),
    [talking, setTalking] = useState(false),
    [notice, setNotice] = useState(""),
    [memories, setMemories] = useState<Memory[]>([]),
    [offered, setOffered] = useState(true),
    [allowOffline, setAllowOffline] = useState(false);
  const activities = useActivities(!!session);
  const chatBottom = useRef<HTMLDivElement>(null),
    identity = useRef(""),
    alive = useRef(true),
    speechTimer = useRef<ReturnType<typeof setTimeout>>(undefined),
    presenceAt = useRef(0);
  useEffect(() => {
    void (async () => {
      try {
        if (localStorage.getItem("ninho-pending-logout")) {
          await api("/api/auth/logout", "POST", {});
          localStorage.removeItem("ninho-pending-logout");
        }
        const s = await restoreSession<Session>();
        if (s?.user) login(s, false);
      } catch {
        try {
          if (!localStorage.getItem("ninho-pending-logout")) {
            const cached = JSON.parse(
              localStorage.getItem("ninho-offline") || "null",
            );
            if (cached?.expires > Date.now()) {
              login(cached.session, false);
              setOffline(true);
              setAllowOffline(true);
            }
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      alive.current = false;
      void stopAI();
    };
  }, []);
  function narrate(s: string) {
    if (!s) return;
    setMessages((v) => [
      ...v,
      { id: crypto.randomUUID(), role: "assistant", text: s },
    ]);
  }
  function login(s: Session, demo = false) {
    identity.current = s.user.id;
    setSession(s);
    setProfile(s.profile);
    setDraft(s.profile);
    setGuest(demo);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Oi, ${s.user.name}! Que bom ter você por aqui. Sou ${s.profile.petName}. Quer fazer uma pequena aventura comigo ou me contar como foi seu dia?`,
      },
    ]);
    setOffered(true);
    if (!demo)
      try {
        const cached = JSON.parse(
          localStorage.getItem("ninho-offline") || "null",
        );
        if (
          cached?.session?.user?.id === s.user.id &&
          cached.expires > Date.now()
        ) {
          setAllowOffline(true);
          localStorage.setItem(
            "ninho-offline",
            JSON.stringify({ ...cached, session: s }),
          );
        }
      } catch {}
    if (location.hash.startsWith("#invite=")) setModal("people");
    if (!demo) void loadMemories(s.user.id);
  }
  async function loadMemories(owner: string) {
    let local: Memory[] = [];
    try {
      local = JSON.parse(
        localStorage.getItem("ninho-memories|" + owner) || "[]",
      );
    } catch {}
    try {
      const result = await api("/api/memories");
      for (const m of local.filter((m) => m.pending))
        try {
          await api("/api/memories", "POST", { id: m.id, kind: m.kind });
          m.pending = false;
        } catch {}
      const merged = [
        ...result.items,
        ...local.filter(
          (m) => !result.items.some((r: Memory) => r.id === m.id),
        ),
      ];
      if (identity.current === owner) {
        setMemories(merged);
        localStorage.setItem("ninho-memories|" + owner, JSON.stringify(merged));
      }
    } catch {
      if (identity.current === owner) setMemories(local);
    }
  }
  function presence(kind = "activity") {
    if (!session || guest || offline || Date.now() - presenceAt.current < 1500)
      return;
    presenceAt.current = Date.now();
    void api("/api/presence", "POST", { kind }).catch(() => {});
  }
  function touch() {
    setCare(true);
    clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setCare(false), 1400);
    presence("care");
  }
  function go(next: string) {
    if (isActivity(next) && activities.status[next].state !== "online") {
      setModal("activities");
      setNotice(
        activities.status[next].state === "checking"
          ? "Estamos conferindo os caminhos."
          : closures[next].title,
      );
      return;
    }
    if (isActivity(next)) tryServiceAgain("/api/games/" + next);
    setScene(next);
    setGame(null);
    setModal("");
    setOffered(false);
    presence();
    if (next === "rest")
      narrate(
        "A gente pode só ficar aqui, sem precisar render nada. Quer ouvir um pouco de silêncio comigo?",
      );
  }
  async function remember(kind: string) {
    if (!session) return;
    const owner = session.user.id,
      m: Memory = {
        id: crypto.randomUUID(),
        kind,
        createdAt: Date.now(),
        pending: !guest,
      };
    const list = [m, ...memories];
    setMemories(list);
    localStorage.setItem("ninho-memories|" + owner, JSON.stringify(list));
    if (!guest)
      try {
        await api("/api/memories", "POST", { id: m.id, kind });
        m.pending = false;
        localStorage.setItem("ninho-memories|" + owner, JSON.stringify(list));
        if (identity.current === owner) setMemories([...list]);
        setNotice("Guardado no nosso álbum.");
      } catch {
        setNotice(
          "Guardamos neste aparelho. Vamos enviar ao seu álbum quando sua conta estiver disponível.",
        );
      }
    else setNotice("Lembrança de apresentação guardada neste aparelho.");
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || talking || !session) return;
    const owner = session.user.id,
      context = messages.slice(-4);
    setText("");
    setMessages((v) => [
      ...v,
      { id: crypto.randomUUID(), role: "user", text: value },
    ]);
    presence("message");
    if (!aiReady) {
      narrate(
        "Recebi o que você contou. Para eu formar respostas com IA neste aparelho, prepare meu companheiro em “Sobre nosso papo”. Enquanto isso, podemos jogar juntos.",
      );
      return;
    }
    setTalking(true);
    try {
      const ai = await localAI();
      const response = await ai.call("reply", {
        text: value,
        context,
        prompt: `Você é ${profile.petName}, um pet digital amigável no jogo Ninho. O usuário se chama ${profile.userDisplayName}. Responda em português brasileiro, em uma ou duas frases naturais, sem listas. Seja curioso e acolhedor, sem diagnosticar, prescrever, prometer proteção, fingir ser psicólogo ou profissional de saúde. Não incentive isolamento, segredo, dependência ou exclusividade com a IA. Em perigo imediato, incentive procurar ajuda humana presencial e o serviço de emergência da região. Não interprete o humor como diagnóstico. Atividade atual: ${scene}; etapa: ${game?.state || "livre"}. Nunca diga que uma atividade terminou antes de FINISHED. Faça no máximo uma pergunta. Não repita a apresentação. Não receba nem tente acessar conversas entre humanos.`,
      });
      if (identity.current === owner) {
        narrate(response.answer);
        if (profile.preferences.voice) {
          const voice = speechSynthesis
            .getVoices()
            .find((v) => v.localService && v.lang.startsWith("pt"));
          if (voice) {
            const utterance = new SpeechSynthesisUtterance(response.answer);
            utterance.voice = voice;
            speechSynthesis.speak(utterance);
          }
        }
      }
    } catch (e) {
      if (identity.current === owner) setNotice((e as Error).message);
    } finally {
      if (identity.current === owner) setTalking(false);
    }
  }
  useEffect(() => {
    chatBottom.current?.parentElement?.scrollTo({
      top: chatBottom.current.parentElement.scrollHeight,
    });
  }, [messages, talking]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function saveProfile() {
    if (guest) {
      setProfile(draft);
      setModal("");
      return;
    }
    try {
      const p = await api<Profile>("/api/profile", "PUT", draft);
      setProfile(p);
      if (session) {
        const s = { ...session, profile: p };
        setSession(s);
        if (allowOffline)
          localStorage.setItem(
            "ninho-offline",
            JSON.stringify({ session: s, expires: Date.now() + 604800000 }),
          );
      }
      setModal("");
      setNotice("Ficou com a nossa cara.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function logout() {
    identity.current = "";
    await stopAI();
    speechSynthesis.cancel();
    clearTimeout(speechTimer.current);
    setAiReady(false);
    setMessages([]);
    setTalking(false);
    setMemories([]);
    setModal("");
    setScene("room");
    setSession(null);
    setOffline(false);
    setAllowOffline(false);
    localStorage.removeItem("ninho-offline");
    if (!guest)
      try {
        await api("/api/auth/logout", "POST", {});
        localStorage.removeItem("ninho-pending-logout");
      } catch {
        localStorage.setItem("ninho-pending-logout", "1");
      }
    setGuest(false);
  }
  if (loading)
    return (
      <main className="loading">
        <span className="brand">ninho .</span>
        <p>Abrindo seu cantinho…</p>
      </main>
    );
  if (!session)
    return (
      <Auth
        onLogin={(s) => login(s)}
        onDemo={() =>
          login(
            {
              user: { id: "demo", name: "Visitante", email: "", age: 18 },
              profile: { ...baseProfile, userDisplayName: "Visitante" },
            },
            true,
          )
        }
      />
    );
  const title =
    scene === "cooking"
      ? "Uma receita e uma boa história."
      : scene === "park"
        ? "Vamos reparar nas pequenas coisas."
        : scene === "fishing"
          ? "O papo continua enquanto a boia descansa."
          : "Um tempinho com " + profile.petName + ".";
  return (
    <div
      className={
        "app" + (profile.preferences.reducedMotion ? " reduce-motion" : "")
      }
      data-nest-theme={profile.environment}
    >
      <nav>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("room");
          }}
        >
          ninho<span> .</span>
          <small>um tempinho só de vocês</small>
        </a>
        <div>
          <button
            aria-label="Personalizar nosso ninho"
            title="Nosso jeitinho"
            onClick={() => {
              setDraft(profile);
              setModal("custom");
            }}
          >
            ✧
          </button>
          <button
            aria-label="Encontrar uma companhia"
            title="Uma conversa a dois"
            onClick={() => setModal("people")}
          >
            ♡
          </button>
          <button aria-label="Abrir menu" onClick={() => setModal("menu")}>
            ☰
          </button>
        </div>
      </nav>
      <div className="world-heading">
        <p className="eyebrow">SEU PEQUENO REFÚGIO</p>
        <h1>{title}</h1>
        <p>Sem metas. Sem pressa. Só um momento de vocês.</p>
      </div>
      {guest && (
        <p className="demo-note">
          Apresentação local · cadastro e amizades estão disponíveis ao entrar
          com uma conta.
        </p>
      )}
      {offline && (
        <p className="demo-note">
          Seu cantinho está aberto neste aparelho. Conta e amizades precisam de
          conexão.
        </p>
      )}
      <main className="play-layout">
        <section className="scene-card">
          <div className="world">
            <Art
              profile={profile}
              scene={
                scene === "fishing"
                  ? "lake"
                  : scene === "cooking"
                    ? "kitchen"
                    : scene === "park"
                      ? "park"
                      : "room"
              }
              care={care}
              progress={game?.progress || 0}
            />
            <span className="scene-label">
              {scene === "room"
                ? "NOSSO CANTINHO"
                : scene === "cooking"
                  ? "NOSSA COZINHA"
                  : scene === "park"
                    ? "UM PASSEIO JUNTOS"
                    : scene === "fishing"
                      ? "UMA TARDE NO LAGO"
                      : "PODE DESCANSAR"}
            </span>
            <button
              className="pet-touch"
              aria-label={"Fazer carinho em " + profile.petName}
              onClick={touch}
            />
            <p className="speech">
              {care
                ? "Gostei desse carinho ♡"
                : scene === "room"
                  ? "Oi, " +
                    profile.userDisplayName +
                    "! Que bom ter você por aqui."
                  : scene === "cooking"
                    ? "Um ingrediente de cada vez. Uma história de cada vez."
                    : scene === "park"
                      ? "Tem tanta coisa bonita para reparar."
                      : "Enquanto a gente espera, pode me contar."}
            </p>
          </div>
          <div className="scene-caption">
            <span>
              <strong>{profile.petName}</strong>
              <small>Seu parceiro de pequenas aventuras</small>
            </span>
            {scene !== "room" && (
              <button className="quiet" onClick={() => go("room")}>
                ← Nosso cantinho
              </button>
            )}
          </div>
          {scene === "room" ? (
            <div className="dock">
              <button onClick={touch}>♡ Carinho</button>
              <button onClick={() => go("rest")}>☾ Ficar de boa</button>
              <button
                className="primary"
                onClick={() => setModal("activities")}
              >
                ✧ O que vamos fazer?
              </button>
            </div>
          ) : scene === "rest" ? (
            <div className="game-panel">
              <p>Não fazer nada também vale.</p>
              <div className="choices">
                <button onClick={touch}>Fazer carinho</button>
                <button
                  onClick={() => {
                    void remember("rest");
                    presence();
                  }}
                >
                  Guardar esta pausa
                </button>
              </div>
            </div>
          ) : (
            <Boundary key={scene} name="A atividade">
              <GamePanel
                key={scene + "|" + session.user.id}
                kind={scene as Kind}
                availability={activities.status[scene as Kind]}
                onOffline={() => activities.offline(scene as Kind)}
                onRetry={() => activities.refresh(scene as Kind)}
                owner={session.user.id}
                guest={guest}
                onNarrate={narrate}
                onGame={setGame}
                onMemory={(k) => void remember(k)}
                onIntent={() => presence()}
                onBack={() => go("room")}
              />
            </Boundary>
          )}
        </section>
        <aside className="chat-panel">
          <header>
            <div>
              <strong>Um papo com {profile.petName}</strong>
              <small>A gente tem tempo.</small>
            </div>
            <button
              aria-label="Sobre nosso papo"
              title="Sobre nosso papo"
              onClick={() => setModal("ai")}
            >
              ✧
            </button>
          </header>
          {!aiReady && (
            <button className="ai-invite" onClick={() => setModal("ai")}>
              Vamos preparar nosso papo? <span>Baixar meu companheiro ↗</span>
            </button>
          )}
          <div
            className="chat-log"
            role="log"
            aria-label="Conversa com seu pet"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={"message " + (m.role === "user" ? "own" : "")}
              >
                <small>
                  {m.role === "user"
                    ? profile.userDisplayName
                    : profile.petName}
                </small>
                <p>{m.text}</p>
              </div>
            ))}
            {talking && (
              <p className="typing">{profile.petName} está pensando…</p>
            )}
            <div ref={chatBottom} />
          </div>
          <form className="composer" onSubmit={send}>
            <label htmlFor="pet-message" className="sr-only">
              Sua mensagem
            </label>
            <input
              id="pet-message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              placeholder="Conta alguma coisa…"
              autoComplete="off"
            />
            <button
              className="primary"
              aria-label="Enviar mensagem"
              disabled={talking || !text.trim()}
            >
              ↑
            </button>
          </form>
          <footer>
            <small>
              {aiReady ? "IA neste aparelho" : "Companhia de apresentação"}
            </small>
            <button className="quiet" onClick={() => setModal("people")}>
              Falar com alguém ♡
            </button>
          </footer>
        </aside>
      </main>
      {offered && scene === "room" && (
        <div className="welcome">
          <p>
            “{profile.userDisplayName}, trouxe uma panelinha. Vamos preparar
            alguma coisa juntos?”
          </p>
          <button
            className="primary"
            disabled={activities.status.cooking.state !== "online"}
            onClick={() => go("cooking")}
          >
            {activities.status.cooking.state === "online"
              ? "Vamos à cozinha"
              : activities.status.cooking.state === "checking"
                ? "Conferindo a cozinha…"
                : "Cozinha fechada para arrumação"}
          </button>
          <button className="quiet" onClick={() => setOffered(false)}>
            Hoje só quero ficar por aqui
          </button>
        </div>
      )}
      <p className="footnote">
        Um toque, uma história, uma pequena aventura. Você já está aqui.
      </p>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal && (
        <Modal
          key={modal}
          title={
            {
              menu: "Seu cantinho",
              custom: "O nosso jeitinho.",
              activities: "Bora fazer algo?",
              album: "Nosso álbum",
              people: "Uma conversa a dois",
              ai: "Sobre nosso papo",
              account: "Seu lugar por aqui",
              presence: "A ideia das 48 horas",
            }[modal] || "Ninho"
          }
          close={() => setModal("")}
        >
          {modal === "activities" && (
            <>
              <p className="activity-help">
                Cada passeio tem seu próprio caminho. Se um estiver fechado, a
                gente escolhe outro.
              </p>
              <div role="status" aria-live="polite" className="sr-only">
                {(["fishing", "cooking", "park"] as Kind[])
                  .map(
                    (k) =>
                      `${k === "fishing" ? "Lago" : k === "cooking" ? "Cozinha" : "Parque"}: ${activities.status[k].state === "online" ? "aberto" : activities.status[k].state === "checking" ? "conferindo" : "temporariamente fechado"}.`,
                  )
                  .join(" ")}
              </div>
              <div className="activity-list">
                {[
                  [
                    "fishing",
                    "🎣",
                    "Uma tarde de pesca",
                    "O lago está uma calmaria.",
                  ],
                  [
                    "cooking",
                    "🥣",
                    "Algo gostoso na cozinha",
                    "Receitas e boas histórias.",
                  ],
                  [
                    "park",
                    "🌳",
                    "Um passeio no parque",
                    "Descobertas pelo caminho.",
                  ],
                  [
                    "rest",
                    "☾",
                    "Ficar de boa em casa",
                    "Sempre disponível, mesmo sem conexão.",
                  ],
                ].map(([id, icon, name, detail]) => {
                  const state = isActivity(id)
                    ? activities.status[id].state
                    : "online";
                  const closed = state === "offline";
                  return (
                    <button
                      key={id}
                      disabled={state !== "online"}
                      className={closed ? "activity-closed" : ""}
                      onClick={() => go(id)}
                      aria-describedby={"activity-status-" + id}
                    >
                      <span aria-hidden="true">{icon}</span>
                      <span>
                        <strong>{name}</strong>
                        <small id={"activity-status-" + id}>
                          {state === "checking"
                            ? "Conferindo se está aberto…"
                            : closed && isActivity(id)
                              ? closures[id].title
                              : detail}
                        </small>
                        {closed && (
                          <span className="closed-badge">
                            Serviço indisponível
                          </span>
                        )}
                      </span>
                      <span aria-hidden="true">
                        {state === "online"
                          ? "↗"
                          : state === "checking"
                            ? "◌"
                            : "⌑"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <details className="connection-help">
                <summary>Um caminho não está abrindo?</summary>
                <p>A conexão é verificada para cada atividade separadamente.</p>
                <a href="/diagnostico.html" target="_blank" rel="noreferrer">
                  Verificar esta instalação
                </a>
              </details>
              <button
                className="quiet"
                onClick={() =>
                  void Promise.all(
                    ["fishing", "cooking", "park"].map((k) =>
                      activities.refresh(k as Kind),
                    ),
                  )
                }
              >
                Verificar os caminhos
              </button>
            </>
          )}
          {modal === "custom" && (
            <>
              <label>
                Nome do seu pet
                <input
                  value={draft.petName}
                  maxLength={20}
                  onChange={(e) =>
                    setDraft({ ...draft, petName: e.target.value })
                  }
                />
              </label>
              <Customizer profile={draft} onChange={setDraft} />
              <button
                className="primary wide"
                disabled={!draft.petName.trim()}
                onClick={saveProfile}
              >
                Guardar nosso jeitinho
              </button>
            </>
          )}
          {modal === "menu" && (
            <div className="menu-list">
              {[
                ["custom", "✧", "Personalizar nosso ninho"],
                ["album", "▤", "Nosso álbum · " + memories.length],
                ["people", "♡", "Conversas e amizades"],
                ["ai", "✦", "Sobre nosso papo"],
                ["account", "⌂", "Conta e aparelho"],
                ["presence", "◷", "A ideia das 48 horas"],
              ].map(([id, icon, name]) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id === "custom") setDraft(profile);
                    setModal(id);
                  }}
                >
                  <span>{icon}</span>
                  {name}
                  <span>↗</span>
                </button>
              ))}
            </div>
          )}
          {modal === "album" && (
            <>
              {!memories.length ? (
                <p className="empty">
                  Nosso álbum está esperando pequenas histórias. Você escolhe o
                  que guardar.
                </p>
              ) : (
                <div className="album">
                  {memories.map((m) => (
                    <article key={m.id}>
                      <span>
                        {m.kind.includes("park")
                          ? "🌿"
                          : ["soup", "cookies"].includes(m.kind)
                            ? "🥣"
                            : m.kind === "rest"
                              ? "☾"
                              : "🐟"}
                      </span>
                      <strong>{labels[m.kind] || m.kind}</strong>
                      <small>
                        {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                        {m.pending ? " · neste aparelho" : ""}
                      </small>
                    </article>
                  ))}
                </div>
              )}
              <button
                className="quiet"
                onClick={() => {
                  if (!guest) void loadMemories(session.user.id);
                }}
              >
                Atualizar álbum
              </button>
            </>
          )}
          {modal === "people" &&
            (guest ? (
              <>
                <p>
                  Crie seu ninho para convidar uma pessoa e conversar de
                  verdade.
                </p>
                <button className="primary" onClick={logout}>
                  Criar minha conta
                </button>
              </>
            ) : (
              <Boundary name="As conversas">
                <People
                  user={session.user}
                  onIntent={() => presence("peer-message")}
                />
              </Boundary>
            ))}
          {modal === "ai" && (
            <LocalAI ready={aiReady} onReady={() => setAiReady(true)} />
          )}
          {modal === "account" && (
            <>
              <h3>Oi, {profile.userDisplayName}.</h3>
              <p>
                {guest
                  ? "Você está na apresentação local."
                  : session.user.email}
              </p>
              {!guest && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={allowOffline}
                    onChange={(e) => {
                      setAllowOffline(e.target.checked);
                      if (e.target.checked)
                        localStorage.setItem(
                          "ninho-offline",
                          JSON.stringify({
                            session,
                            expires: Date.now() + 604800000,
                          }),
                        );
                      else localStorage.removeItem("ninho-offline");
                    }}
                  />
                  Permitir abrir meu cantinho sem internet neste aparelho
                  pessoal, por até 7 dias.
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.preferences.reducedMotion}
                  onChange={(e) => {
                    const p = {
                      ...profile,
                      preferences: {
                        ...profile.preferences,
                        reducedMotion: e.target.checked,
                      },
                    };
                    setProfile(p);
                    if (!guest)
                      void api("/api/profile", "PUT", p).catch(() =>
                        setNotice(
                          "Essa preferência ficou apenas neste aparelho por enquanto.",
                        ),
                      );
                  }}
                />
                Menos animações
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.preferences.voice}
                  onChange={(e) => {
                    const p = {
                      ...profile,
                      preferences: {
                        ...profile.preferences,
                        voice: e.target.checked,
                      },
                    };
                    setProfile(p);
                    if (!guest)
                      void api("/api/profile", "PUT", p).catch(() => {});
                  }}
                />
                Ouvir o pet com uma voz em português instalada no aparelho
              </label>
              <p className="fine">
                A captura por microfone ainda não está disponível. O envio de
                e-mails também aguarda configuração.
              </p>
              <button className="wide" onClick={logout}>
                Sair e bloquear meu cantinho
              </button>
            </>
          )}
          {modal === "presence" && (
            <>
              <p>
                Interagir com o pet confirma que você passou por aqui, sem uma
                tarefa de check-in. Toques, mensagens e ações nos jogos
                registram presença.
              </p>
              <p>
                Na proposta, 48 horas sem interação poderiam avisar uma pessoa
                de confiança, com autorização. Esta instalação registra a
                presença, mas ainda não envia alertas reais.
              </p>
              <p className="fine">
                O Ninho é um protótipo de companhia. A ausência de interação e o
                humor do pet não são diagnósticos nem garantias de segurança.
              </p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
export default function Ninho() {
  return (
    <Boundary name="O Ninho">
      <App />
    </Boundary>
  );
}
