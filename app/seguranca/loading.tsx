import { PageSkeleton } from "@/components/ui/Skeleton";

export default function SecurityLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-page)] p-4">
      <div className="w-full max-w-md">
        <PageSkeleton variant="form" />
      </div>
    </main>
  );
}
