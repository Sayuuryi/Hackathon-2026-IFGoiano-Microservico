import { useEffect, useRef, useState } from "react";
import { localAI, stopAI } from "./ai-client";
export function LocalAI({
  ready,
  onReady,
}: {
  ready: boolean;
  onReady: () => void;
}) {
  const [status, setStatus] = useState(
      ready
        ? "Pronto para conversar"
        : "Prepare neste aparelho para conversar com IA.",
    ),
    [busy, setBusy] = useState(false),
    [controller, setController] = useState<AbortController>();
  const mounted = useRef(true),
    preparing = useRef(false),
    abort = useRef<AbortController>(undefined);
  useEffect(
    () => () => {
      mounted.current = false;
      abort.current?.abort();
      if (preparing.current) void stopAI();
    },
    [],
  );
  async function prepare(file?: File) {
    preparing.current = true;
    setBusy(true);
    const c = new AbortController();
    abort.current = c;
    setController(c);
    try {
      const ai = await localAI();
      await ai.cacheRuntime(c.signal, (p: any) =>
        setStatus("Preparando os arquivos: " + p.bytes + "/" + p.total),
      );
      await ai.prepareModel({
        file,
        signal: c.signal,
        progress: (p: any) =>
          setStatus(
            (p.stage === "verifying" ? "Conferindo" : "Baixando") +
              ": " +
              Math.floor((100 * p.bytes) / p.total) +
              "%",
          ),
      });
      setStatus("Arquivos conferidos. Abrindo o companheiro…");
      c.signal.throwIfAborted();
      await ai.call("load");
      if (!mounted.current) return;
      onReady();
      setStatus("Pronto para conversar");
    } catch (e) {
      if (mounted.current)
        setStatus(
          c.signal.aborted
            ? "Pausado. Você pode retomar."
            : (e as Error).message,
        );
    } finally {
      preparing.current = false;
      abort.current = undefined;
      if (mounted.current) {
        setBusy(false);
        setController(undefined);
      }
    }
  }
  return (
    <section>
      <h3>Seu companheiro neste aparelho</h3>
      <p>
        A IA é baixada e executada no navegador. Suas falas com o pet não vão
        para um servidor de IA.
      </p>
      <p>
        O modelo precisa de cerca de 2 GB de download e um aparelho compatível.
        Pode ser lento ou responder de forma inadequada. É companhia de jogo;
        não faz diagnóstico ou terapia.
      </p>
      <p role="status">{status}</p>
      <div className="choices">
        <button
          disabled={busy || ready}
          className="primary"
          onClick={() => prepare()}
        >
          Baixar ou retomar
        </button>
        <label className="file-button">
          Usar arquivo já baixado
          <input
            type="file"
            accept=".litertlm"
            disabled={busy || ready}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void prepare(f);
            }}
          />
        </label>
        {busy && <button onClick={() => controller?.abort()}>Pausar</button>}
      </div>
      <p className="fine">
        Um download feito no site público pertence àquele endereço. Esta
        instalação usa outro armazenamento. Você pode importar o mesmo arquivo.
        A qualidade das respostas depende do modelo e do aparelho.
      </p>
    </section>
  );
}
