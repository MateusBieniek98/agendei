"use client";

import RouteError from "@/components/ui/RouteError";

export default function GestorError({ reset }: { reset: () => void }) {
  return <RouteError title="Não foi possível carregar a visão do gestor" reset={reset} />;
}
