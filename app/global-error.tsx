"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f4f6f8",
          color: "#17202a",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ width: "100%", maxWidth: 520, borderTop: "4px solid #1f6b4f" }}>
          <h1 style={{ margin: "24px 0 8px", fontSize: 24 }}>Serviço temporariamente indisponível</h1>
          <p style={{ margin: "0 0 24px", lineHeight: 1.6, color: "#52606d" }}>
            Não foi possível concluir esta tela. O erro foi registrado para análise.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              border: 0,
              borderRadius: 6,
              padding: "0 18px",
              background: "#234f86",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
