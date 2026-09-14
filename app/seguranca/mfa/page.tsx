import { redirect } from "next/navigation";
import {
  getCurrentTenantContext,
  getPlatformMfaStatus,
  isCurrentUserPlatformAdmin,
} from "@/lib/auth";
import MfaSetup from "./MfaSetup";

export const dynamic = "force-dynamic";

export default async function PlatformMfaPage() {
  const [tenant, platformAdmin] = await Promise.all([
    getCurrentTenantContext(),
    isCurrentUserPlatformAdmin(),
  ]);
  const customerAdmin = tenant?.membership.role === "admin";
  if (!platformAdmin && !customerAdmin) redirect("/");
  const assurance = await getPlatformMfaStatus();
  const next = platformAdmin ? "/platform" : "/admin";
  if (assurance.currentLevel === "aal2") redirect(next);
  return <MfaSetup next={next} required={platformAdmin} />;
}
