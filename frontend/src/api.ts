export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId = "",
  ) {
    super(message);
  }
}
const circuits = new Map<string, { failures: number; until: number }>();
const service = (p: string) =>
  p.startsWith("/api/friends")
    ? "social"
    : p.match(/\/games\/(\w+)/)?.[1] || "account";
let refreshing: Promise<unknown> | undefined;
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<T> {
  const key = service(path),
    state = circuits.get(key);
  if (state && state.until > Date.now())
    throw new ApiError(
      503,
      "CIRCUIT_OPEN",
      "Esse pedacinho está descansando. Vamos tentar de novo em instantes.",
    );
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        response.status || 503,
        "INVALID_RESPONSE",
        "Não consegui alcançar esse pedacinho do Ninho.",
      );
    }
    if (response.status === 401 && retry && !path.startsWith("/api/auth/")) {
      refreshing ||= api("/api/auth/refresh", "POST", {}, false).finally(() => {
        refreshing = undefined;
      });
      await refreshing;
      return api<T>(path, method, body, false);
    }
    if (!response.ok)
      throw new ApiError(
        response.status,
        data.code || "REQUEST_FAILED",
        (data.code === "VALIDATION_ERROR" && data.fields?.length
          ? data.fields
              .map(
                (f: any) =>
                  (
                    ({
                      password: "Senha",
                      email: "E-mail",
                      name: "Nome",
                      age: "Idade",
                      petName: "Nome do pet",
                    }) as Record<string, string>
                  )[f.field] || f.field,
              )
              .join(", ") + ": confira os campos indicados."
          : data.detail) || "Não consegui concluir agora. Tente outra vez.",
        data.requestId || response.headers.get("X-Request-Id") || "",
      );
    circuits.delete(key);
    return data as T;
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(
            503,
            "CONNECTION_LOST",
            "Não consegui conectar agora. O seu cantinho continua por aqui.",
          );
    if (error.status >= 500) {
      const failures = (circuits.get(key)?.failures || 0) + 1;
      circuits.set(key, {
        failures,
        until: failures >= 2 ? Date.now() + 15000 : 0,
      });
    }
    throw error;
  }
}
export function tryServiceAgain(path: string) {
  circuits.delete(service(path));
}

/** A missing short-lived cookie is anonymous to /me, so explicitly try refresh once. */
export async function restoreSession<
  T extends { user: unknown },
>(): Promise<T | null> {
  const current = await api<T>("/api/me");
  if (current?.user) return current;
  try {
    await api("/api/auth/refresh", "POST", {}, false);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
  const renewed = await api<T>("/api/me");
  return renewed?.user ? renewed : null;
}
