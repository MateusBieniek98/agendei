"use client";

import RouteError from "@/components/ui/RouteError";

export default function AdminError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
