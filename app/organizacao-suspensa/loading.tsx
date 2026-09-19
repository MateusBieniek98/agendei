import { FormSkeleton } from "@/components/ui/Skeleton";

export default function SuspendedOrganizationLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-page)] px-4 py-10">
      <FormSkeleton fields={3} className="w-full max-w-lg" />
    </main>
  );
}
