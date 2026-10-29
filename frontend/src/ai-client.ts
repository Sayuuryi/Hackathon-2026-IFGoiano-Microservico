let modulePromise: Promise<any>;
export function localAI(): Promise<any> {
  const url = "/assets/local-ai.js";
  return (modulePromise ||= import(/* @vite-ignore */ url).catch((e) => {
    modulePromise = undefined as any;
    throw e;
  }));
}
export async function stopAI() {
  if (!modulePromise) return;
  try {
    (await localAI()).stop();
  } catch {}
}
