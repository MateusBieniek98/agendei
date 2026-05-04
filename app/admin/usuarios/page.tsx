"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Profile, UserRole } from "@/lib/types";

type ProfileWithEquipe = Profile & { equipes: { nome: string } | null };

const ROLES: { value: UserRole; label: string }[] = [
  { value: "encarregado", label: "Encarregado" },
  { value: "admin", label: "Admin" },
  { value: "gestor", label: "Gestor" },
];

export default function UsuariosPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProfileWithEquipe[]>([]);

  async function carregar() {
    const r = await fetch("/api/usuarios");
    const j = await r.json();
    setItems((j.items ?? []) as ProfileWithEquipe[]);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function patch(id: string, body: Partial<Profile>) {
    const r = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!r.ok) toast("Erro.", "error");
    else { toast("Atualizado.", "success"); carregar(); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Gerencie papéis e ativação. Para criar novos usuários, use o convite por
          e-mail no Supabase Auth (Auth → Users → Invite).
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-ink-50)] text-[var(--color-ink-500)] text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Papel</th>
                <th className="px-4 py-2 font-medium">Equipe</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-ink-100)]">
                  <td className="px-4 py-2">{u.nome}</td>
                  <td className="px-4 py-2 text-[var(--color-ink-700)]">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => patch(u.id, { role: e.target.value as UserRole })}
                      className="border border-[var(--color-ink-300)] rounded-md text-sm px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-[var(--color-ink-500)]">
                    {u.equipes?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {u.ativo
                      ? <Badge tone="success">ativo</Badge>
                      : <Badge tone="danger">inativo</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch(u.id, { ativo: !u.ativo })}
                    >
                      {u.ativo ? "desativar" : "ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
