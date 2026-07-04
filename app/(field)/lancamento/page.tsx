import { requireRole } from "@/lib/auth";
import LancamentoFormPage, {
  type LancamentoFormSearchParams,
} from "@/components/lancamentos/LancamentoFormPage";

export const dynamic = "force-dynamic";

export default async function LancamentoPage({
  searchParams,
}: {
  searchParams: Promise<LancamentoFormSearchParams>;
}) {
  const profile = await requireRole(["encarregado", "admin"]);
  const params = await searchParams;

  return (
    <LancamentoFormPage
      profile={profile}
      searchParams={params}
      afterEditHref="/resumo"
    />
  );
}
