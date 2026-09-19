import { Skeleton } from "@/components/ui/Skeleton";

export default function LoginLoading() {
  return (
    <main className="min-h-dvh bg-[#173f35]">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[minmax(320px,0.82fr)_minmax(520px,1.18fr)]">
        <div className="hidden border-r border-white/12 p-12 lg:block" />
        <section className="flex min-h-dvh items-center justify-center bg-[#f3f5f2] px-5 py-8 sm:px-8 lg:px-14">
          <div className="w-full max-w-[430px] space-y-5" role="status" aria-label="Carregando acesso">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-8 h-13 w-full" />
            <Skeleton className="h-13 w-full" />
            <Skeleton className="h-13 w-full" />
          </div>
        </section>
      </div>
    </main>
  );
}
