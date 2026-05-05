"use client";

import RouteError from "@/components/ui/RouteError";

export default function FieldError({ reset }: { reset: () => void }) {
  return <RouteError title="Não foi possível carregar a tela de campo" reset={reset} />;
}
