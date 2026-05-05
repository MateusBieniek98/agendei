"use client";

import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function RouteError({
  title = "Não foi possível carregar esta seção",
  reset,
}: {
  title?: string;
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold">
          !
        </div>
        <h1 className="mt-4 text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-500)]">
          O app encontrou um dado inesperado nessa tela. Tente recarregar; se
          persistir, volte para o dashboard.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Recarregar</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/admin";
            }}
          >
            Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
