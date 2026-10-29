import { useState } from "react";
import type { Kind } from "./types";
import { closures } from "./activities";
export function Unavailable({
  place,
  retry,
  back,
  kind,
}: {
  place: string;
  retry: () => void | Promise<unknown>;
  back?: () => void;
  kind?: Kind;
}) {
  const [checking, setChecking] = useState(false),
    [retried, setRetried] = useState(false);
  return (
    <div className="unavailable" role="status">
      <span aria-hidden="true">☁</span>
      <h3>
        {kind ? closures[kind].title : place + " está fazendo uma pausa."}
      </h3>
      <p>
        {kind
          ? closures[kind].detail
          : "Não conseguimos abrir esse pedacinho do Ninho agora."}{" "}
        Seu pet e as outras atividades continuam por aqui.
      </p>
      <div className="choices">
        <button
          className="primary"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try {
              await retry();
              setRetried(true);
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? "Conferindo o caminho…" : "Verificar novamente"}
        </button>
        {back && <button onClick={back}>Voltar ao ninho</button>}
      </div>
      <small>
        {retried
          ? "Se ainda estiver fechado, podemos escolher outra atividade."
          : "Avisaremos aqui quando estiver disponível de novo."}
      </small>
    </div>
  );
}
