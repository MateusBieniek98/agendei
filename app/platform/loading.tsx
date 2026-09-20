import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function PlatformLoading() {
  return (
    <main
      className="min-h-dvh bg-[var(--bg-page)] p-4 sm:p-6 lg:p-8"
      aria-label="Carregando operações da plataforma"
    >
      <div className="mx-auto max-w-[1480px] space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Card>
          <CardBody><TableSkeleton rows={7} columns={6} /></CardBody>
        </Card>
      </div>
    </main>
  );
}
