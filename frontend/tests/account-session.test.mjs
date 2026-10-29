import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const input = {
  name: "Clara",
  age: 26,
  email: "synthetic@example.test",
  password: "Synthetic-Test-2026!",
  petName: "Pingo",
  petColor: 2,
  accessory: "star",
  environment: "night",
};
const session = {
  user: {
    id: "synthetic-user",
    name: input.name,
    age: input.age,
    email: input.email,
  },
  profile: {
    userDisplayName: input.name,
    userAge: input.age,
    petName: input.petName,
    petColor: input.petColor,
    accessory: input.accessory,
    environment: input.environment,
    preferences: { voice: false, reducedMotion: false },
  },
};
async function run(fetcher, check) {
  const built = await build({
    entryPoints: ["src/account-session.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const { AccountFlow } = await import(
    "data:text/javascript;base64," +
      Buffer.from(built.outputFiles[0].text).toString("base64")
  );
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (path, options) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, body, method: options.method });
    return fetcher(path, body, calls);
  };
  try {
    await check(new AccountFlow(), calls);
  } finally {
    globalThis.fetch = original;
  }
}

test("signup sends the selected appearance before login and confirms the cookie session", async () => {
  await run(
    async () => Response.json(session),
    async (flow, calls) => {
      const result = await flow.submit("register", input);
      assert.equal(result.profile.petColor, 2);
      assert.equal(result.profile.environment, "night");
      assert.deepEqual(
        calls.map((c) => c.path),
        ["/api/auth/register", "/api/me"],
      );
      assert.deepEqual(calls[0].body, input);
    },
  );
});

test("a missing first cookie is repaired by one automatic login", async () => {
  let me = 0;
  await run(
    async (path) =>
      Response.json(
        path === "/api/me" && me++ === 0 ? { user: null } : session,
      ),
    async (flow, calls) => {
      assert.equal(
        (await flow.submit("register", input)).user.id,
        session.user.id,
      );
      assert.deepEqual(
        calls.map((c) => c.path),
        ["/api/auth/register", "/api/me", "/api/auth/login", "/api/me"],
      );
    },
  );
});

test("retry after cookies were refused does not create the account twice and preserves new choices", async () => {
  let accepted = false;
  await run(
    async (path, body) => {
      if (path === "/api/me")
        return Response.json(accepted ? session : { user: null });
      if (path === "/api/profile") return Response.json(body);
      return Response.json(session);
    },
    async (flow, calls) => {
      await assert.rejects(
        flow.submit("register", input),
        (e) => e.code === "SESSION_NOT_PERSISTED",
      );
      accepted = true;
      const result = await flow.submit("register", {
        ...input,
        petColor: 1,
        environment: "dusk",
      });
      assert.equal(
        calls.filter((c) => c.path === "/api/auth/register").length,
        1,
      );
      assert.equal(result.profile.petColor, 1);
      assert.equal(result.profile.environment, "dusk");
      const update = calls.find((c) => c.path === "/api/profile");
      assert.equal(update.method, "PUT");
      assert.ok(
        calls.findIndex((c) => c === update) >
          calls.map((c) => c.path).lastIndexOf("/api/me"),
      );
    },
  );
});

test("an expired cookie during signup is repaired without a refresh/login loop", async () => {
  let me = 0;
  await run(
    async (path) =>
      path === "/api/me" && me++ === 0
        ? Response.json({ code: "AUTH_REQUIRED" }, { status: 401 })
        : Response.json(session),
    async (flow, calls) => {
      assert.equal(
        (await flow.submit("register", input)).user.id,
        session.user.id,
      );
      assert.equal(calls.filter((c) => c.path === "/api/auth/login").length, 1);
      assert.ok(!calls.some((c) => c.path === "/api/auth/refresh"));
    },
  );
});

test("a public signup blocked by security is reported as installation failure, never a prerequisite to log in", async () => {
  await run(
    async () =>
      Response.json(
        { code: "AUTH_REQUIRED", detail: "Entre na sua conta para continuar." },
        { status: 401, headers: { "X-Request-Id": "synthetic-request" } },
      ),
    async (flow, calls) => {
      await assert.rejects(
        flow.submit("register", input),
        (e) =>
          e.code === "AUTH_ENDPOINT_PROTECTED" &&
          e.requestId === "synthetic-request",
      );
      assert.equal(calls.length, 1);
    },
  );
});

test("an internal signup failure cannot be mistaken for successful authentication", async () => {
  await run(
    async () =>
      Response.json(
        { code: "SERVICE_UNAVAILABLE", detail: "Tente outra vez." },
        { status: 503 },
      ),
    async (flow, calls) => {
      await assert.rejects(
        flow.submit("register", input),
        (e) => e.status === 503 && e.code === "SERVICE_UNAVAILABLE",
      );
      assert.equal(calls.length, 1);
    },
  );
});

test("a session belonging to another account is never accepted", async () => {
  await run(
    async (path) =>
      Response.json(
        path === "/api/me"
          ? { ...session, user: { ...session.user, id: "another-user" } }
          : session,
      ),
    async (flow) => {
      await assert.rejects(
        flow.submit("register", input),
        (e) => e.code === "SESSION_NOT_PERSISTED",
      );
    },
  );
});
