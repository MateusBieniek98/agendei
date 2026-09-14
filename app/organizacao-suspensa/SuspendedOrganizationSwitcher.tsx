"use client";

import { useState } from "react";

export default function SuspendedOrganizationSwitcher({
  organizations,
}: {
  organizations: Array<{ id: string; name: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (organizations.length === 0) return null;

  async function switchOrganization(organizationId: string) {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      window.location.assign(body.home ?? "/");
      return;
    }
    setLoading(false);
    setError(body.error ?? "Não foi possível trocar de empresa.");
  }

  return (
    <div className="mt-5 rounded-lg border border-[var(--border)] p-4 text-left">
      <label className="block text-sm font-bold">
        Acessar outra empresa
        <select
          defaultValue=""
          disabled={loading}
          onChange={(event) => void switchOrganization(event.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm"
        >
          <option value="" disabled>Selecione</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </select>
      </label>
      {error && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p>}
    </div>
  );
}
