const revision = "2026-10-28-r4";
const definitions = {
  fishing: ["lake"],
  cooking: ["soup", "cookies"],
  park: ["park-lake", "park-flowers"],
};
const paths = [
  { name: "Entrada do site", path: "/health", plain: true },
  {
    name: "Cadastro e login",
    path: "/api/auth/status",
    accepts: (b) => b?.available === true,
  },
  ...Object.keys(definitions).map((kind) => ({
    name: { fishing: "Lago", cooking: "Cozinha", park: "Parque" }[kind],
    path: `/api/games/${kind}/catalog`,
    accepts: (b) =>
      Array.isArray(b?.items) &&
      definitions[kind].every((id) =>
        b.items.some(
          (i) =>
            i?.id === id &&
            typeof i.name === "string" &&
            Array.isArray(i.items),
        ),
      ),
  })),
];
let report;
const el = (id) => document.getElementById(id);
async function request(item) {
  const c = new AbortController(),
    t = setTimeout(() => c.abort(), 12000),
    start = Date.now();
  try {
    const r = await fetch(item.path, {
      cache: "no-store",
      credentials: "omit",
      signal: c.signal,
      headers: { Accept: "application/json" },
    });
    let body;
    try {
      body = item.plain ? await r.text() : await r.json();
    } catch {}
    const online = r.ok && (item.plain ? body === "ok" : item.accepts(body));
    return {
      name: item.name,
      path: item.path,
      online,
      status: r.status,
      code: online
        ? "READY"
        : typeof body?.code === "string"
          ? body.code
          : "UNEXPECTED_RESPONSE",
      service: r.headers.get("X-Ninho-Service"),
      revision: r.headers.get("X-Ninho-Revision"),
      elapsedMs: Date.now() - start,
    };
  } catch {
    return {
      name: item.name,
      path: item.path,
      online: false,
      code: c.signal.aborted ? "TIMEOUT" : "CONNECTION_LOST",
      elapsedMs: Date.now() - start,
    };
  } finally {
    clearTimeout(t);
  }
}
function explain(r) {
  if (r.online && r.path === "/health")
    return "O frontend está acessível neste endereço. Cada API é conferida separadamente abaixo.";
  if (r.online)
    return "Caminho aberto. A API respondeu e acessou os dados necessários.";
  if (r.code === "DEPENDENCY_UNAVAILABLE")
    return "A API respondeu, mas não conseguiu acessar seu próprio banco. Confira o banco e as credenciais já usadas no volume.";
  if (r.code === "UPSTREAM_UNREACHABLE" || r.code === "SERVICE_UNAVAILABLE")
    return "O frontend está aberto, mas o proxy não alcançou esta API. Confira os logs, a rede edge e se o serviço terminou de iniciar.";
  if (
    r.status === 404 ||
    r.code === "UNEXPECTED_RESPONSE" ||
    r.code === "INVALID_RESPONSE"
  )
    return "A resposta não corresponde à API esperada. Pode haver imagens de versões diferentes ou outro site nesta porta. Recrie as imagens desta pasta.";
  if (r.status === 401 || r.status === 403)
    return "Esta consulta pública foi bloqueada. Confira se as imagens de frontend e backend são da mesma revisão.";
  if (r.code === "TIMEOUT")
    return "A API demorou mais de 12 segundos. Ela pode estar iniciando ou sem recursos para responder.";
  return "Não foi possível chegar a este caminho. Verifique o endereço e os logs do serviço.";
}
async function run() {
  el("refresh").disabled = true;
  el("copy").disabled = true;
  el("progress").textContent = "Conferindo o site, a conta e cada atividade…";
  const [build, ...results] = await Promise.all([
    fetch("/build.json", { cache: "no-store", credentials: "omit" })
      .then((r) => r.json())
      .catch(() => null),
    ...paths.map(request),
  ]);
  report = {
    pageRevision: revision,
    origin: location.origin,
    frontend: build?.revision || "não identificada",
    sourceHash: build?.sourceHash,
    checkedAt: new Date().toISOString(),
    results,
  };
  el("installation").textContent =
    `Endereço: ${location.origin} · Frontend: ${report.frontend}`;
  el("results").replaceChildren();
  for (const r of results) {
    const card = document.createElement("article");
    card.dataset.state = r.online ? "online" : "offline";
    const h = document.createElement("h2");
    h.textContent = r.name + " · " + (r.online ? "disponível" : "indisponível");
    const p = document.createElement("p");
    p.textContent = explain(r);
    const small = document.createElement("small");
    small.textContent = `${r.path} · HTTP ${r.status ?? "sem resposta"} · ${r.code} · ${r.elapsedMs} ms · ${r.path === "/health" ? "Frontend " + report.frontend : "API " + (r.revision || "sem revisão identificada")}`;
    card.append(h, p, small);
    el("results").append(card);
  }
  el("progress").textContent =
    "Verificação concluída. " +
    results.filter((r) => r.online).length +
    " de " +
    results.length +
    " caminhos disponíveis.";
  el("refresh").disabled = false;
  el("copy").disabled = false;
}
el("refresh").addEventListener("click", run);
el("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    el("progress").textContent =
      "Diagnóstico copiado. Ele não contém senhas, cookies ou dados de conta.";
  } catch {
    el("progress").textContent = JSON.stringify(report, null, 2);
  }
});
void run();
