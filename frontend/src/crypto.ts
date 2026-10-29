// No plaintext or key is sent to the relay. The invitation secret stays in the URL fragment.
export type Envelope = { v: 1; id: string; iv: string; ciphertext: string };
const enc = new TextEncoder(),
  dec = new TextDecoder();
export function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function un64(s: string) {
  if (!/^[\w-]+$/.test(s)) throw Error("Convite inválido.");
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
}
export function newSecret() {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}
export function parseInvite(text: string) {
  const value = text.includes("#") ? new URL(text).hash.slice(1) : text;
  const match = /^invite=([0-9a-f-]{36})\.([\w-]{43})$/i.exec(value);
  if (!match) throw Error("Cole o convite completo, com a parte depois de #.");
  return { id: match[1], secret: match[2] };
}
async function key(id: string, secret: string, sender: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    un64(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(id),
      info: enc.encode("ninho-v2-e2ee|" + sender),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  room: string,
  secret: string,
  sender: string,
  text: string,
): Promise<Envelope> {
  const id = b64(crypto.getRandomValues(new Uint8Array(16))),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(room + "|" + sender + "|" + id),
    },
    await key(room, secret, sender),
    enc.encode(text),
  );
  return { v: 1, id, iv: b64(iv), ciphertext: b64(new Uint8Array(bytes)) };
}
export async function open(
  room: string,
  secret: string,
  sender: string,
  e: Envelope,
) {
  if (e.v !== 1 || !["host", "guest"].includes(sender))
    throw Error("Mensagem incompatível.");
  return dec.decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: un64(e.iv),
        additionalData: enc.encode(room + "|" + sender + "|" + e.id),
      },
      await key(room, secret, sender),
      un64(e.ciphertext),
    ),
  );
}
let db: Promise<IDBDatabase>;
function database() {
  return (db ||= new Promise((resolve, reject) => {
    const r = indexedDB.open("ninho-docker-private", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("keys");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(Error("Não consegui guardar a chave neste aparelho."));
  }));
}
export async function saveSecret(user: string, id: string, secret: string) {
  const d = await database();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("keys", "readwrite");
    t.objectStore("keys").put(secret, user + "|" + id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function readSecret(
  user: string,
  id: string,
): Promise<string | undefined> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const r = d
      .transaction("keys")
      .objectStore("keys")
      .get(user + "|" + id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
