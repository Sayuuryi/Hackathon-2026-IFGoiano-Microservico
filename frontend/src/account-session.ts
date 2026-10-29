import { api, ApiError, tryServiceAgain } from "./api";
import type { Session } from "./types";

export type AccountInput = {
  email: string;
  password: string;
  name?: string;
  age?: number;
  petName?: string;
  petColor?: number;
  accessory?: string;
  environment?: string;
};

/** A receipt prevents a second registration when signup succeeded but session setup failed. */
export class AccountFlow {
  private receipt?: { email: string; userId: string };

  private async current(): Promise<Session | null> {
    try {
      const session = await api<Session>("/api/me", "GET", undefined, false);
      return session?.user?.id && session?.profile ? session : null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  }

  async submit(
    mode: "register" | "login",
    input: AccountInput,
  ): Promise<Session> {
    const email = input.email.trim().toLowerCase();
    const resuming = mode === "register" && this.receipt?.email === email;
    const endpoint = "/api/auth/" + (resuming ? "login" : mode);
    tryServiceAgain(endpoint);
    let issued: Session;
    try {
      issued = await api<Session>(
        endpoint,
        "POST",
        mode === "login" || resuming
          ? { email: input.email, password: input.password }
          : input,
      );
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        e.code === "AUTH_REQUIRED"
      ) {
        throw new ApiError(
          401,
          "AUTH_ENDPOINT_PROTECTED",
          "A instalação bloqueou a entrada da conta antes de concluir esta etapa. Confira a versão do serviço de conta em “Verificar esta instalação”.",
          e.requestId,
        );
      }
      throw e;
    }
    if (!issued?.user?.id || !issued?.profile)
      throw new ApiError(
        502,
        "INVALID_AUTH_RESPONSE",
        "A conta não devolveu uma confirmação válida. Suas escolhas continuam aqui.",
      );
    if (mode === "register" && !resuming)
      this.receipt = { email, userId: issued.user.id };
    let confirmed = await this.current();
    // One automatic sign-in repairs a missing/old cookie without another registration.
    if (mode === "register" && confirmed?.user.id !== issued.user.id) {
      tryServiceAgain("/api/auth/login");
      issued = await api<Session>("/api/auth/login", "POST", {
        email: input.email,
        password: input.password,
      });
      confirmed = await this.current();
    }
    if (
      !confirmed ||
      confirmed.user.id !== issued.user.id ||
      (resuming && confirmed.user.id !== this.receipt?.userId)
    )
      throw new ApiError(
        503,
        "SESSION_NOT_PERSISTED",
        "O navegador não manteve sua entrada. Suas escolhas continuam aqui. Abra “Verificar esta instalação” para conferir a conexão e os cookies.",
      );
    if (resuming) {
      const p = confirmed.profile;
      const selected = {
        ...p,
        userDisplayName: input.name!,
        userAge: input.age!,
        petName: input.petName!,
        petColor: input.petColor!,
        accessory: input.accessory!,
        environment: input.environment!,
      };
      if (JSON.stringify(selected) !== JSON.stringify(p)) {
        confirmed = {
          ...confirmed,
          profile: await api("/api/profile", "PUT", selected),
        };
      }
    }
    return confirmed;
  }
}
