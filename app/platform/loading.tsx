import { PageSkeleton } from "@/components/ui/Skeleton";

export default function PlatformLoading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-page)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <PageSkeleton variant="list" />
      </div>
    </main>
  );
}
