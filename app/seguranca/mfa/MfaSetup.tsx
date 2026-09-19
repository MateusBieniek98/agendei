"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/branding/Logo";
import Button from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MfaSetup({ next, required }: { next: string; required: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function prepare() {
      const supabase = createClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factorsError) {
        setError(factorsError.message);
        setLoading(false);
        return;
      }
      const verified = factors.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setLoading(false);
        return;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: required ? "Administração da plataforma" : "Administração da empresa",
      });
      if (!active) return;
      if (enrollError) {
        setError(enrollError.message);
      } else {
        setFactorId(data.id);
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
      }
      setLoading(false);
    }
    void prepare();
    return () => {
      active = false;
    };
  }, [required]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId || code.replace(/\D/g, "").length !== 6) {
      setError("Informe o código de seis dígitos do autenticador.");
      return;
    }
    setVerifying(true);
    setError("");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\D/g, ""),
    });
    if (verifyError) {
      setError(verifyError.message);
      setVerifying(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg-page)] p-4">
      <section className="ui-surface w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <Logo size={48} />
        <p className="mt-5 text-xs font-bold uppercase text-[var(--text-muted)]">Segurança da conta</p>
        <h1 className="mt-1 text-2xl font-bold">Autenticação em dois fatores</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {required
            ? "O acesso administrativo da plataforma exige um código temporário além da senha."
            : "Proteja o acesso administrativo da empresa com um código temporário além da senha."}
        </p>

        {loading && (
          <div className="mt-6 space-y-3" role="status" aria-label="Preparando autenticação">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mx-auto h-[220px] w-[220px]" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
        {!loading && enrollment && (
          <div className="mt-5 space-y-3">
            <p className="text-sm">Leia o QR Code no Google Authenticator, Microsoft Authenticator ou aplicativo equivalente.</p>
            <Image src={enrollment.qrCode} alt="QR Code para configurar o autenticador" width={220} height={220} unoptimized className="mx-auto rounded-xl bg-white p-3" />
            <details className="rounded-lg border border-[var(--border)] p-3 text-xs">
              <summary className="cursor-pointer font-bold">Configurar manualmente</summary>
              <code className="mt-2 block break-all">{enrollment.secret}</code>
            </details>
          </div>
        )}
        {!loading && !enrollment && !error && (
          <p className="mt-5 text-sm">Abra o autenticador já vinculado e informe o código atual.</p>
        )}

        {!loading && factorId && (
          <form onSubmit={verify} className="mt-5 space-y-3">
            <label className="block text-sm font-bold">
              Código de seis dígitos
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-1 h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-center text-xl font-bold tabular-nums"
              />
            </label>
            <Button type="submit" loading={verifying} className="h-11 w-full">
              Validar e entrar
            </Button>
          </form>
        )}
        {error && <p className="mt-4 rounded-lg bg-[var(--danger-bg)] p-3 text-sm font-semibold text-[var(--danger)]">{error}</p>}
      </section>
    </main>
  );
}
