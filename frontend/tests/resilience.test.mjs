import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
async function source(name) {
  const result = await build({
    entryPoints: ["src/" + name + ".ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "es2022",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
}
test("reopening renews a valid refresh session when the short cookie is absent", async () => {
  const { restoreSession, tryServiceAgain } = await source("api");
  tryServiceAgain("/api/me");
  const original = globalThis.fetch;
  const paths = [];
  let renewed = false;
  globalThis.fetch = async (path) => {
    paths.push(path);
    if (path === "/api/auth/refresh") {
      renewed = true;
      return Response.json({ ok: true });
    }
    return Response.json({ user: renewed ? { id: "synthetic-user" } : null });
  };
  try {
    const result = await restoreSession();
    assert.equal(result.user.id, "synthetic-user");
    assert.deepEqual(paths, ["/api/me", "/api/auth/refresh", "/api/me"]);
    globalThis.fetch = async (path) =>
      Response.json(
        path === "/api/me" ? { user: null } : { code: "SESSION_EXPIRED" },
        { status: path === "/api/me" ? 200 : 401 },
      );
    assert.equal(await restoreSession(), null);
  } finally {
    globalThis.fetch = original;
  }
});
test("a failed cooking service opens only its own circuit; retry restores it", async () => {
  const { api, tryServiceAgain } = await source("api");
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (path) => {
    count++;
    return new Response(
      JSON.stringify(
        path.includes("cooking")
          ? {
              detail: "Temporariamente indisponível",
              code: "SERVICE_UNAVAILABLE",
            }
          : { items: [] },
      ),
      {
        status: path.includes("cooking") ? 503 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    await assert.rejects(api("/api/games/cooking/catalog"));
    await assert.rejects(api("/api/games/cooking/catalog"));
    const before = count;
    await assert.rejects(
      api("/api/games/cooking/catalog"),
      (e) => e.code === "CIRCUIT_OPEN",
    );
    assert.equal(count, before);
    assert.deepEqual(await api("/api/games/park/catalog"), { items: [] });
    tryServiceAgain("/api/games/cooking");
    await assert.rejects(
      api("/api/games/cooking/catalog"),
      (e) => e.code === "SERVICE_UNAVAILABLE",
    );
    assert.equal(count, before + 2);
  } finally {
    globalThis.fetch = original;
  }
});

const catalogs = {
  fishing: { items: [{ id: "lake", name: "Pesca", items: ["sunfish"] }] },
  cooking: {
    items: ["soup", "cookies"].map((id) => ({
      id,
      name: id,
      items: ["flour"],
    })),
  },
  park: {
    items: ["park-lake", "park-flowers"].map((id) => ({
      id,
      name: id,
      items: ["bird"],
    })),
  },
};
test("activity discovery closes only the failed destination and reopens when it recovers", async () => {
  const { ActivityMonitor } = await source("activities");
  let parkDown = true;
  const paths = [];
  const monitor = new ActivityMonitor(async (url) => {
    paths.push(url);
    const kind = url.split("/")[3];
    return Response.json(
      kind === "park" && parkDown
        ? { code: "UPSTREAM_UNREACHABLE" }
        : catalogs[kind],
      { status: kind === "park" && parkDown ? 503 : 200 },
    );
  });
  await monitor.checkAll();
  assert.equal(monitor.snapshot().park.state, "offline");
  assert.equal(monitor.snapshot().cooking.state, "online");
  assert.equal(monitor.snapshot().fishing.state, "online");
  assert.ok(paths.every((p) => p.endsWith("/catalog")));
  parkDown = false;
  await monitor.check("park");
  assert.equal(monitor.snapshot().park.state, "online");
});
test("an old health response cannot reopen a destination after a failed action", async () => {
  const { ActivityMonitor } = await source("activities");
  let finish;
  const monitor = new ActivityMonitor(
    () => new Promise((resolve) => (finish = resolve)),
  );
  const pending = monitor.check("park");
  monitor.offline("park");
  finish(Response.json(catalogs.park));
  await pending;
  assert.equal(monitor.snapshot().park.state, "offline");
});
test("HTML errors and responses for another service never enable an activity", async () => {
  const { ActivityMonitor } = await source("activities");
  const m = new ActivityMonitor(
    async () => new Response("<html>error</html>", { status: 502 }),
  );
  await m.check("park");
  assert.equal(m.snapshot().park.state, "offline");
  const fake = new ActivityMonitor(async () =>
    Response.json({ available: true, service: "cooking" }),
  );
  await fake.check("park");
  assert.equal(fake.snapshot().park.state, "offline");
});
test("ciphertext authentication binds room, sender and message; altered text cannot decrypt", async () => {
  const { seal, open, newSecret } = await source("crypto");
  const room = crypto.randomUUID(),
    secret = newSecret();
  const e = await seal(room, secret, "host", "Uma história só nossa.");
  assert.equal(await open(room, secret, "host", e), "Uma história só nossa.");
  await assert.rejects(open(room, secret, "guest", e));
  await assert.rejects(open(crypto.randomUUID(), secret, "host", e));
  await assert.rejects(open(room, newSecret(), "host", e));
  const changed = {
    ...e,
    ciphertext: (e.ciphertext[0] === "A" ? "B" : "A") + e.ciphertext.slice(1),
  };
  await assert.rejects(open(room, secret, "host", changed));
  assert.ok(!JSON.stringify(e).includes("história"));
});
test("local demonstration keeps cooking order and does not finish before its timer", async () => {
  const { startLocal, actLocal } = await source("local-games");
  let g = startLocal("cooking", "soup");
  assert.throws(() => actLocal(g, "mix"));
  assert.throws(() => actLocal(g, "ingredient", "flour"));
  for (const i of ["carrot", "potato", "pumpkin"])
    g = actLocal(g, "ingredient", i);
  assert.equal(g.state, "MIXING");
  for (let i = 0; i < 3; i++) g = actLocal(g, "mix");
  assert.equal(g.state, "COOKING");
  assert.throws(() => actLocal(g, "finish"));
  assert.equal(
    actLocal({ ...g, readyAt: Date.now() - 1 }, "finish").state,
    "FINISHED",
  );
});

test("account readiness is advisory; submit is disabled only during a pending request", async () => {
  const { canSubmitAccount, probeJson } = await source("connectivity");
  assert.equal(canSubmitAccount(false), true);
  assert.equal(canSubmitAccount(true), false);
  const result = await probeJson(
    "/api/auth/status",
    (b) => b?.available === true,
    async () => Response.json({ code: "NOT_FOUND" }, { status: 404 }),
  );
  assert.equal(result.online, false);
  assert.equal(canSubmitAccount(false), true);
});
test("activities work without new readiness routes and do not send expired cookies", async () => {
  const { ActivityMonitor } = await source("activities");
  const m = new ActivityMonitor(async (path, options) => {
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.ok(path.endsWith("/catalog"));
    return Response.json(catalogs[path.split("/")[3]]);
  });
  await m.checkAll();
  for (const kind of ["fishing", "cooking", "park"])
    assert.equal(m.snapshot()[kind].state, "online");
});
test("a slow live API is not declared offline at the old 3.5-second cutoff", async () => {
  const { ActivityMonitor } = await source("activities");
  const m = new ActivityMonitor(async () => {
    await new Promise((r) => setTimeout(r, 3700));
    return Response.json(catalogs.park);
  });
  await m.check("park");
  assert.equal(m.snapshot().park.state, "online");
});
test("request timeouts work without AbortSignal.timeout and carry a diagnostic code", async () => {
  const { probeJson } = await source("connectivity");
  const original = AbortSignal.timeout;
  AbortSignal.timeout = undefined;
  try {
    const result = await probeJson(
      "/synthetic",
      () => true,
      async (_path, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(Error("abort"))),
        ),
      10,
    );
    assert.equal(result.online, false);
    assert.equal(result.code, "TIMEOUT");
  } finally {
    AbortSignal.timeout = original;
  }
});
test("five stop/start cycles affect only the chosen activity", async () => {
  const { ActivityMonitor } = await source("activities");
  let down = "";
  const m = new ActivityMonitor(async (path) => {
    const kind = path.split("/")[3];
    return kind === down
      ? Response.json({ code: "UPSTREAM_UNREACHABLE" }, { status: 503 })
      : Response.json(catalogs[kind]);
  });
  for (let i = 0; i < 5; i++)
    for (const kind of ["park", "cooking", "fishing"]) {
      down = kind;
      await m.checkAll();
      for (const other of ["park", "cooking", "fishing"])
        assert.equal(
          m.snapshot()[other].state,
          other === kind ? "offline" : "online",
        );
      down = "";
      await m.check(kind);
      assert.equal(m.snapshot()[kind].state, "online");
    }
});

test("a confirmed healthy game clears its old circuit before the next start", async () => {
  const result = await build({
    stdin: {
      contents: "export * from './src/api'; export * from './src/activities';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const { api, ActivityMonitor } = await import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  );
  const original = globalThis.fetch;
  let down = true;
  let sent = 0;
  globalThis.fetch = async (p) => {
    sent++;
    if (down)
      return Response.json({ code: "UPSTREAM_UNREACHABLE" }, { status: 503 });
    return Response.json(
      p.endsWith("/catalog") ? catalogs.park : { id: "new-session" },
    );
  };
  try {
    await assert.rejects(api("/api/games/park/sessions", "POST", {}));
    await assert.rejects(api("/api/games/park/sessions", "POST", {}));
    await assert.rejects(
      api("/api/games/park/sessions", "POST", {}),
      (e) => e.code === "CIRCUIT_OPEN",
    );
    assert.equal(sent, 2);
    down = false;
    const m = new ActivityMonitor();
    await m.check("park");
    assert.equal(m.snapshot().park.state, "online");
    assert.equal(
      (await api("/api/games/park/sessions", "POST", {})).id,
      "new-session",
    );
    assert.equal(sent, 4);
  } finally {
    globalThis.fetch = original;
  }
});
