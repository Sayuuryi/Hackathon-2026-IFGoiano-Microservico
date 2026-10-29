import { useState, useEffect, useRef } from "react";
import { ApiError } from "./api";
import { AccountFlow } from "./account-session";
import { Art } from "./Art";
import { baseProfile, type Profile, type Session } from "./types";
import { canSubmitAccount, probeJson } from "./connectivity";
export function Customizer({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  return (
    <>
      <Art profile={profile} />
      <fieldset>
        <legend>A cor do seu pet</legend>
        <div className="choices">
          {["Caramelo", "Lavanda", "Pistache"].map((n, i) => (
            <button
              type="button"
              key={n}
              aria-pressed={profile.petColor === i}
              onClick={() => onChange({ ...profile, petColor: i })}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Um detalhe de personalidade</legend>
        <div className="choices">
          {[
            ["leaf", "🌱 Brotinho"],
            ["bow", "🎀 Laço"],
            ["star", "⭐ Estrelinha"],
          ].map(([id, n]) => (
            <button
              type="button"
              key={id}
              aria-pressed={profile.accessory === id}
              onClick={() => onChange({ ...profile, accessory: id })}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>O clima do nosso ninho</legend>
        <div className="choices">
          {[
            ["garden", "Jardim"],
            ["dusk", "Pôr do sol"],
            ["night", "Noite estrelada"],
          ].map(([id, n]) => (
            <button
              type="button"
              key={id}
              aria-pressed={profile.environment === id}
              onClick={() => onChange({ ...profile, environment: id })}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
export function Auth({
  onLogin,
  onDemo,
}: {
  onLogin: (s: Session) => void;
  onDemo: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register"),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState(baseProfile),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [errorInfo, setErrorInfo] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const flow = useRef(new AccountFlow());
  const [accountState, setAccountState] = useState("checking");
  const mounted = useRef(true);
  const checking = useRef(false);
  async function checkAccount() {
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await probeJson(
        "/api/auth/status",
        (data) => data?.available === true,
      );
      if (mounted.current)
        setAccountState(result.online ? "online" : "offline");
    } finally {
      checking.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    void checkAccount();
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") void checkAccount();
    }, 5000);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmitAccount(busy)) return;
    setError("");
    setErrorInfo("");
    setErrorCode("");
    // Read the form once before removing step-one inputs, including browser autofill.
    const form = new FormData(e.currentTarget);
    const currentEmail = step ? email : String(form.get("email") ?? email);
    const currentPassword = step
      ? password
      : String(form.get("password") ?? password);
    setEmail(currentEmail);
    setPassword(currentPassword);
    if (mode === "register" && step === 0) {
      setProfile({
        ...profile,
        userDisplayName: String(form.get("name") ?? profile.userDisplayName),
        userAge: Number(form.get("age") ?? profile.userAge),
        petName: String(form.get("petName") ?? profile.petName),
      });
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const s = await flow.current.submit(
        mode,
        mode === "login"
          ? { email: currentEmail, password: currentPassword }
          : {
              email: currentEmail,
              password: currentPassword,
              name: profile.userDisplayName,
              age: profile.userAge,
              petName: profile.petName,
              petColor: profile.petColor,
              accessory: profile.accessory,
              environment: profile.environment,
            },
      );
      setPassword("");
      setAccountState("online");
      onLogin(s);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) {
        setErrorCode(e.code);
        setErrorInfo(
          `HTTP ${e.status} · ${e.code}${e.requestId ? " · Pedido " + e.requestId : ""}`,
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-intro">
        <a className="brand" href="/">
          ninho<span> .</span>
        </a>
        <p className="eyebrow">UM LUGAR PARA VOLTAR</p>
        <h1>
          Seu dia pode ter
          <br />
          um pouco mais
          <br />
          <em>de companhia.</em>
        </h1>
        <p>
          Um pet curioso. Pequenas aventuras.
          <br />E tempo para conversar, do seu jeito.
        </p>
        <Art profile={profile} />
        <small>Sem metas. Sem pressa. Um momento de vocês.</small>
      </section>
      <section className="auth-card">
        <div className="tabs">
          {[
            ["register", "Criar meu ninho"],
            ["login", "Já tenho um ninho"],
          ].map(([id, n]) => (
            <button
              key={id}
              aria-pressed={mode === id}
              disabled={busy}
              onClick={() => {
                setMode(id as "register" | "login");
                setStep(0);
                setError("");
                setErrorCode("");
                setErrorInfo("");
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <h2>
          {step
            ? "Vamos deixar com a sua cara?"
            : mode === "login"
              ? "Que bom ter você de volta."
              : "Vamos nos conhecer?"}
        </h2>
        <p>
          {step
            ? "Você pode mudar tudo depois."
            : "Um cadastro simples para guardar seu cantinho."}
        </p>
        <div className="account-availability" role="status">
          {accountState === "checking" ? (
            "Conferindo a porta do seu ninho…"
          ) : accountState === "offline" ? (
            <>
              <p>
                Não conseguimos confirmar a conexão com sua conta. Você pode
                tentar continuar; se não der certo, seus dados ficam aqui para
                tentar de novo.
              </p>
              <button
                type="button"
                className="quiet"
                onClick={() => void checkAccount()}
              >
                Verificar conexão com a conta
              </button>
            </>
          ) : null}
        </div>
        <form onSubmit={submit}>
          {mode === "register" && step === 0 && (
            <>
              <label>
                Como você quer ser chamado?
                <input
                  name="name"
                  required
                  maxLength={30}
                  value={profile.userDisplayName}
                  onChange={(e) =>
                    setProfile({ ...profile, userDisplayName: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Sua idade
                  <input
                    name="age"
                    required
                    type="number"
                    min={18}
                    max={120}
                    value={profile.userAge}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        userAge: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Nome do seu pet
                  <input
                    name="petName"
                    required
                    maxLength={20}
                    value={profile.petName}
                    onChange={(e) =>
                      setProfile({ ...profile, petName: e.target.value })
                    }
                  />
                </label>
              </div>
            </>
          )}
          {!step && (
            <>
              <label>
                E-mail
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={200}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  required
                  type="password"
                  minLength={mode === "register" ? 10 : 1}
                  maxLength={72}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {mode === "register" && (
                <small>
                  Use pelo menos 10 caracteres. Esta demonstração aceita maiores
                  de 18 anos.
                </small>
              )}
            </>
          )}
          {step === 1 && <Customizer profile={profile} onChange={setProfile} />}
          <p role="alert" className="error">
            {error}
          </p>
          {errorCode === "EMAIL_IN_USE" && (
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setMode("login");
                setStep(0);
                setError("");
                setErrorCode("");
              }}
            >
              Entrar com essa conta
            </button>
          )}
          <button className="primary wide" disabled={!canSubmitAccount(busy)}>
            {busy
              ? "Preparando…"
              : step
                ? "Criar nosso ninho"
                : mode === "login"
                  ? "Voltar ao meu cantinho"
                  : "Escolher nosso jeitinho"}
          </button>
          {step > 0 && (
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Voltar
            </button>
          )}
        </form>
        <button className="quiet" onClick={onDemo}>
          Conhecer a apresentação
        </button>
        <p className="fine">
          A conversa com o pet fica no aparelho. Verificação de e-mail e
          recuperação de senha ainda não estão ativadas nesta instalação.
        </p>
        <details className="connection-help">
          <summary>Está com dificuldade para conectar?</summary>
          {errorInfo && <p>{errorInfo}</p>}
          <p>
            Abra a verificação para conferir a conta e cada atividade desta
            instalação.
          </p>
          <a href="/diagnostico.html" target="_blank" rel="noreferrer">
            Verificar esta instalação
          </a>
        </details>
      </section>
    </main>
  );
}
