import Link from "next/link";
import { requireRole } from "@/lib/auth";
import LancamentoFormPage, {
  type LancamentoFormSearchParams,
} from "@/components/lancamentos/LancamentoFormPage";

export const dynamic = "force-dynamic";

export default async function NovoLancamentoAdminPage({
  searchParams,
}: {
  searchParams: Promise<LancamentoFormSearchParams>;
}) {
  const profile = await requireRole(["admin"]);
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/lancamentos"
        className="inline-flex h-10 items-center rounded-lg border px-3 text-sm font-bold transition hover:opacity-80"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        Voltar para lançamentos
      </Link>

      <LancamentoFormPage
        profile={profile}
        searchParams={params}
        title="Novo lançamento"
        subtitle="Registre apontamento mantendo o acesso administrativo."
        afterCreateHref="/admin/lancamentos"
        afterEditHref="/admin/lancamentos"
        resetAfterCreate={false}
      />
    </div>
  );
}
