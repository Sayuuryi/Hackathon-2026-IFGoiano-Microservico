import { useEffect, useRef, useState } from "react";
import { api, ApiError, tryServiceAgain } from "./api";
import {
  newSecret,
  parseInvite,
  readSecret,
  saveSecret,
  seal,
  open,
} from "./crypto";
import type { Friend, User } from "./types";
import { Unavailable } from "./Unavailable";
export function People({
  user,
  onIntent,
}: {
  user: User;
  onIntent: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(""),
    [link, setLink] = useState(""),
    [room, setRoom] = useState<Friend | null>(null),
    [preview, setPreview] = useState<any>(null),
    [copied, setCopied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  async function refresh() {
    try {
      setFriends((await api("/api/friends")).friends);
      setError("");
      setUnavailable(false);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status >= 500) setUnavailable(true);
    }
  }
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 12000);
    return () => clearInterval(t);
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const id = crypto.randomUUID(),
        secret = newSecret();
      await saveSecret(user.id, id, secret);
      await api("/api/friends/invites", "POST", { id });
      setLink(
        location.origin + location.pathname + "#invite=" + id + "." + secret,
      );
      setCopied(false);
      await refresh();
      onIntent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect(text = invite) {
    setError("");
    try {
      const p = parseInvite(text);
      const result = await api("/api/friends/" + p.id + "/preview");
      setInvite(text);
      setPreview({ ...result, ...p });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (location.hash.startsWith("#invite=")) {
      const text = location.href;
      history.replaceState(null, "", location.pathname + location.search);
      void inspect(text);
    }
  }, []);
  async function join() {
    setBusy(true);
    try {
      await saveSecret(user.id, preview.id, preview.secret);
      const f = await api<Friend>(
        "/api/friends/" + preview.id + "/accept",
        "POST",
        {},
      );
      setPreview(null);
      setInvite("");
      await refresh();
      setRoom(f);
      onIntent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share(f: Friend) {
    try {
      const secret = await readSecret(user.id, f.id);
      if (!secret)
        throw Error(
          "A chave deste convite está no aparelho que o criou. Peça o link completo para recuperá-la.",
        );
      setLink(
        location.origin + location.pathname + "#invite=" + f.id + "." + secret,
      );
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (room)
    return (
      <Conversation
        key={room.id}
        user={user}
        friend={room}
        onBack={() => {
          setRoom(null);
          void refresh();
        }}
        onIntent={onIntent}
      />
    );
  if (unavailable)
    return (
      <Unavailable
        place="O encontro com suas amizades"
        retry={() => {
          tryServiceAgain("/api/friends");
          void refresh();
        }}
      />
    );
  return (
    <section>
      <h3>Uma conversa de verdade.</h3>
      <p>
        Só duas pessoas, com espaço para se escutar. Compartilhe um convite com
        alguém de confiança.
      </p>
      <button className="primary" disabled={busy} onClick={create}>
        Criar convite
      </button>
      {link && (
        <div className="invite-result">
          <label>
            Seu convite está pronto
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError("Selecione e copie o link acima.");
              }
            }}
          >
            {copied ? "Convite copiado ✓" : "Copiar convite"}
          </button>
          <p className="fine">
            O link contém a chave da conversa. Envie apenas para a pessoa
            escolhida. Convites novos valem por 24 horas e recebem uma pessoa.
          </p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void inspect();
        }}
      >
        <label>
          Recebeu um convite?
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="Cole o link completo aqui"
          />
        </label>
        <button disabled={busy}>Conhecer o convite</button>
      </form>
      {preview && (
        <div className="invite-result">
          <p>{preview.name} reservou um lugar para conversar com você.</p>
          <div className="choices">
            <button className="primary" disabled={busy} onClick={join}>
              Aceitar e conversar
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await api(
                    "/api/friends/" + preview.id + "/decline",
                    "POST",
                    {},
                  );
                  setPreview(null);
                  setInvite("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      )}
      <p role="alert" className="error">
        {error}
      </p>
      {error && (
        <button
          onClick={() => {
            tryServiceAgain("/api/friends");
            void refresh();
          }}
        >
          Tentar novamente
        </button>
      )}
      <div className="friends">
        {friends.map((f) => (
          <div key={f.id}>
            <span>
              <strong>
                {f.status === "pending" ? "Um lugar reservado" : f.name}
              </strong>
              <small>
                {f.status === "pending"
                  ? "Esperando seu convite chegar"
                  : f.blockedByMe
                    ? "Conversa pausada por você"
                    : !f.available
                      ? "Conversa indisponível"
                      : "Uma conversa a dois"}
              </small>
            </span>
            {f.status === "pending" ? (
              <button onClick={() => share(f)}>Ver convite</button>
            ) : (
              <button onClick={() => setRoom(f)}>Conversar</button>
            )}
          </div>
        ))}
      </div>
      <p className="fine">
        As mensagens são cifradas no seu navegador. A chave fica neste aparelho
        e no convite. Sem ela, outro aparelho não consegue abrir o histórico. O
        servidor recebe o texto cifrado e os metadados de entrega; os nomes das
        amizades não são cifrados.
      </p>
    </section>
  );
}
function Conversation({
  user,
  friend,
  onBack,
  onIntent,
}: {
  user: User;
  friend: Friend;
  onBack: () => void;
  onIntent: () => void;
}) {
  const [messages, setMessages] = useState<
      { id: string; own: boolean; text: string }[]
    >([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(friend.blockedByMe),
    [serviceDown, setServiceDown] = useState(false),
    [pending, setPending] = useState<{ text: string; envelope: any } | null>(
      null,
    ),
    [options, setOptions] = useState(false);
  const seq = useRef(0),
    alive = useRef(true),
    bottom = useRef<HTMLDivElement>(null),
    polling = useRef(false);
  async function poll() {
    if (polling.current || blocked) return;
    polling.current = true;
    try {
      const secret = await readSecret(user.id, friend.id);
      if (!secret)
        throw Error(
          "Falta a chave desta conversa neste aparelho. Volte e cole o convite completo para recuperá-la.",
        );
      const result = await api(
        "/api/friends/" + friend.id + "/messages?after=" + seq.current,
      );
      for (const m of result.messages) {
        let text: string;
        try {
          text = await open(friend.id, secret, m.sender, m.envelope);
        } catch {
          text =
            "Não foi possível abrir esta mensagem com a chave deste aparelho.";
        }
        if (!alive.current) return;
        setMessages((v) =>
          v.some((x) => x.id === m.envelope.id)
            ? v
            : [
                ...v,
                { id: m.envelope.id, own: m.sender === friend.role, text },
              ],
        );
        seq.current = Math.max(seq.current, m.seq);
      }
      if (alive.current) {
        setError("");
        setServiceDown(false);
      }
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && e.status >= 500) setServiceDown(true);
      }
    } finally {
      polling.current = false;
    }
  }
  useEffect(() => {
    alive.current = true;
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [blocked]);
  useEffect(
    () =>
      bottom.current?.parentElement?.scrollTo({
        top: bottom.current.parentElement.scrollHeight,
      }),
    [messages],
  );
  async function send() {
    if (busy || blocked || serviceDown) return;
    const value = (pending?.text || text).trim();
    if (!value) return;
    setBusy(true);
    try {
      const secret = await readSecret(user.id, friend.id);
      if (!secret) throw Error("Falta a chave desta conversa.");
      const envelope =
        pending?.envelope ||
        (await seal(friend.id, secret, friend.role, value));
      setPending({ text: value, envelope });
      await api("/api/friends/" + friend.id + "/messages", "POST", envelope);
      if (alive.current) {
        setMessages((v) =>
          v.some((x) => x.id === envelope.id)
            ? v
            : [...v, { id: envelope.id, own: true, text: value }],
        );
        setText("");
        setPending(null);
        setError("");
        onIntent();
        void poll();
      }
    } catch (e) {
      setError("A mensagem ainda não foi confirmada. " + (e as Error).message);
      if (e instanceof ApiError && e.status >= 500) setServiceDown(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="conversation">
      <div className="conversation-top">
        <button onClick={onBack}>← Voltar</button>
        <h3>{friend.name}</h3>
        <button
          aria-label="Opções desta conversa"
          onClick={() => setOptions(!options)}
        >
          •••
        </button>
      </div>
      <small>Só vocês dois. Mensagens com criptografia de ponta a ponta.</small>
      {serviceDown && (
        <Unavailable
          place="A conversa"
          back={onBack}
          retry={() => {
            tryServiceAgain("/api/friends");
            void poll();
          }}
        />
      )}
      {options && (
        <div className="choices">
          <button
            onClick={async () => {
              try {
                await api(
                  "/api/friends/" +
                    friend.id +
                    (blocked ? "/unblock" : "/block"),
                  "POST",
                  {},
                );
                setBlocked(!blocked);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {blocked ? "Retomar conversa" : "Bloquear esta pessoa"}
          </button>
          <button
            onClick={async () => {
              if (
                !confirm(
                  "Encerrar esta amizade e remover o histórico cifrado do servidor?",
                )
              )
                return;
              try {
                await api("/api/friends/" + friend.id, "DELETE");
                onBack();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Encerrar amizade
          </button>
        </div>
      )}
      <div className="peer-log" role="log" aria-label="Conversa com amizade">
        {messages.length === 0 && (
          <p className="empty">Um espaço só de vocês. Um oi já é um começo.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={"message " + (m.own ? "own" : "")}>
            <small>{m.own ? "Você" : friend.name}</small>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <p className="error" role="alert">
        {serviceDown ? "" : error}
      </p>
      {blocked ? (
        <p>Esta conversa está bloqueada por você.</p>
      ) : (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="peer-message">
            Mensagem para {friend.name}
          </label>
          <input
            id="peer-message"
            value={text}
            disabled={busy || !!pending || serviceDown}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
            placeholder="Um oi, uma história…"
          />
          <button
            className="primary"
            disabled={busy || serviceDown || (!pending && !text.trim())}
          >
            {busy ? "Enviando…" : pending ? "Tentar enviar" : "Enviar"}
          </button>
        </form>
      )}
      {pending && !busy && (
        <button
          className="quiet"
          onClick={() => {
            setText(pending.text);
            setPending(null);
          }}
        >
          Editar mensagem ainda não confirmada
        </button>
      )}
    </section>
  );
}
