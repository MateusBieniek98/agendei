import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/branding/Logo";
import { getCurrentTenantContext } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/navigation";
import { PRODUCT_BRAND } from "@/lib/product-brand";
import SuspendedOrganizationSwitcher from "./SuspendedOrganizationSwitcher";

export const dynamic = "force-dynamic";

export default async function SuspendedOrganizationPage() {
  const tenant = await getCurrentTenantContext();
  if (!tenant) redirect("/login?erro=organizacao");
  if (
    tenant.organization.status !== "suspended" &&
    tenant.organization.status !== "cancelled"
  ) {
    redirect(defaultRouteForRole(tenant.profile.role));
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-page)] px-4 py-10">
      <section className="ui-surface w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-7 text-center">
        <Logo size={64} className="justify-center" />
        <p className="mt-5 text-xs font-bold uppercase text-[var(--text-muted)]">
          {tenant.organization.display_name}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Acesso da empresa suspenso
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Os dados permanecem preservados, mas a operação está temporariamente bloqueada.
          Fale com o atendimento para regularizar o contrato.
        </p>
        {tenant.organization.suspended_reason && (
          <p className="mt-4 rounded-lg bg-[var(--bg-card-alt)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            {tenant.organization.suspended_reason}
          </p>
        )}
        <SuspendedOrganizationSwitcher
          organizations={tenant.availableOrganizations
            .filter(({ organization }) => ["active", "onboarding"].includes(organization.status))
            .map(({ organization }) => ({ id: organization.id, name: organization.display_name }))}
        />
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {PRODUCT_BRAND.supportEmail && (
            <a
              href={`mailto:${PRODUCT_BRAND.supportEmail}`}
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white"
            >
              Contatar atendimento
            </a>
          )}
          <Link
            href="/api/auth/logout"
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)]"
          >
            Sair
          </Link>
        </div>
      </section>
    </main>
  );
}
