/** A failed readiness check must never become a permanent form lock. */
export function canSubmitAccount(busy: boolean): boolean {
  return !busy;
}

export type ProbeResult = {
  online: boolean;
  status?: number;
  code: string;
  checkedAt: number;
};

/** Own controller also works in browsers without AbortSignal.timeout. */
export async function probeJson(
  path: string,
  accepts: (body: any) => boolean,
  fetcher: typeof fetch = (...args) => fetch(...args),
  timeoutMs = 12000,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(path, {
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    let body: any;
    try {
      body = await response.json();
    } catch {
      return {
        online: false,
        status: response.status,
        code: "INVALID_RESPONSE",
        checkedAt: Date.now(),
      };
    }
    const online = response.ok && accepts(body);
    return {
      online,
      status: response.status,
      code: online
        ? "READY"
        : typeof body?.code === "string"
          ? body.code
          : "UNEXPECTED_RESPONSE",
      checkedAt: Date.now(),
    };
  } catch {
    return {
      online: false,
      code: controller.signal.aborted ? "TIMEOUT" : "CONNECTION_LOST",
      checkedAt: Date.now(),
    };
  } finally {
    clearTimeout(timer);
  }
}
