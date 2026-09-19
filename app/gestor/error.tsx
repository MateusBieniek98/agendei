"use client";

import RouteError from "@/components/ui/RouteError";

export default function GestorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      title="Não foi possível carregar a visão do gestor"
      reset={reset}
    />
  );
}
