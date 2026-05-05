"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Equipe, Profile, UserRole } from "@/lib/types";

type ProfileWithEquipe = Profile & { equipes: { nome: string } | null };

const ROLES: { value: UserRole; label: string }[] = [
  { value: "encarregado", label: "Encarregado" },
  { value: "admin", label: "Admin" },
  { value: "gestor", label: "Gestor" },
];

type NovoUsuario = {
  email: string;
  senha: string;
  nome: string;
  role: UserRole;
  equipe_id: string;
};

const NOVO_VAZIO: NovoUsuario = {
  email: "",
  senha: "",
  nome: "",
  role: "encarregado",
  equipe_id: "",
};

export default function UsuariosPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ProfileWithEquipe[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState<NovoUsuario>(NOVO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [resetando, setResetando] = useState<ProfileWithEquipe | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  async function carregar() {
    try {
      const [u, e] = await Promise.all([
        fetch("/api/usuarios").then((r) => r.json()),
        fetch("/api/equipes").then((r) => r.json()),
      ]);
      setItems(Array.isArray(u.items) ? (u.items as ProfileWithEquipe[]) : []);
      setEquipes(Array.isArray(e.items) ? (e.items as Equipe[]) : []);
    } catch (err) {
      setItems([]);
      setEquipes([]);
      toast(`Erro ao carregar usuários: ${(err as Error).message}`, "error");
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(id: string, body: Partial<Profile>) {
    const r = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!r.ok) toast("Erro ao atualizar.", "error");
    else {
      toast("Atualizado.", "success");
      carregar();
    }
  }

  async function criar() {
    if (!novo.email || !novo.senha || !novo.nome) {
      toast("Preencha nome, e-mail e senha.", "error");
      return;
    }
    if (novo.senha.length < 6) {
      toast("Senha precisa ter ao menos 6 caracteres.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/usuarios/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: novo.email,
          senha: novo.senha,
          nome: novo.nome,
          role: novo.role,
          equipe_id: novo.equipe_id || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }
      toast("Usuário criado!", "success");
      setCriando(false);
      setNovo(NOVO_VAZIO);
      carregar();
    } finally {
      setEnviando(false);
    }
  }

  async function resetSenha() {
    if (!resetando) return;
    if (novaSenha.length < 6) {
      toast("Senha precisa ter ao menos 6 caracteres.", "error");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/usuarios/${resetando.id}/senha`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ senha: novaSenha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(`Erro: ${j.error ?? r.statusText}`, "error");
        return;
      }
      toast(`Senha de ${resetando.nome} atualizada.`, "success");
      setResetando(null);
      setNovaSenha("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-[var(--color-ink-500)]">
            Crie acessos personalizados (encarregado, admin, gestor),
            altere papéis, ative/desative ou redefina senhas.
          </p>
        </div>
        <Button onClick={() => setCriando(true)}>+ Novo usuário</Button>
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
                      className="rounded-md border-2 border-[var(--color-ink-300)] bg-white px-2 py-1 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={u.equipe_id ?? ""}
                      onChange={(e) =>
                        patch(u.id, {
                          equipe_id: e.target.value ? e.target.value : null,
                        })
                      }
                      className="rounded-md border-2 border-[var(--color-ink-300)] bg-white px-2 py-1 text-sm font-semibold text-[var(--color-ink-900)] shadow-sm"
                    >
                      <option value="">—</option>
                      {equipes.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {u.ativo ? (
                      <Badge tone="success">ativo</Badge>
                    ) : (
                      <Badge tone="danger">inativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setResetando(u)}
                      className="text-[var(--color-gn-700)] hover:underline mr-3 text-xs"
                    >
                      resetar senha
                    </button>
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
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-500)]">
                    Sem usuários cadastrados ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: novo usuário */}
      {criando && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setCriando(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold">Novo usuário</h3>
              <p className="text-xs text-[var(--color-ink-500)] mt-1">
                Cria conta com e-mail/senha já confirmados — o usuário pode
                logar imediatamente.
              </p>
            </div>
            <Input
              label="Nome completo"
              value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              placeholder="Ex.: João Silva"
            />
            <Input
              label="E-mail"
              type="email"
              value={novo.email}
              onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              placeholder="usuario@gn.com.br"
              autoComplete="off"
            />
            <Input
              label="Senha inicial"
              type="text"
              value={novo.senha}
              onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
              placeholder="mín. 6 caracteres"
              hint="Mostra texto pra você poder repassar pro usuário."
              autoComplete="new-password"
            />
            <Select
              label="Papel"
              value={novo.role}
              onChange={(e) =>
                setNovo({ ...novo, role: e.target.value as UserRole })
              }
              options={ROLES}
            />
            <Select
              label="Equipe (opcional)"
              value={novo.equipe_id}
              onChange={(e) => setNovo({ ...novo, equipe_id: e.target.value })}
              options={equipes.map((eq) => ({ value: eq.id, label: eq.nome }))}
              placeholder="Sem equipe"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
              <Button onClick={criar} loading={enviando}>
                Criar usuário
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: reset de senha */}
      {resetando && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setResetando(null);
            setNovaSenha("");
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Redefinir senha</h3>
            <p className="text-sm text-[var(--color-ink-700)]">
              Defina uma nova senha para <strong>{resetando.nome}</strong>{" "}
              ({resetando.email}).
            </p>
            <Input
              label="Nova senha"
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="mín. 6 caracteres"
              autoComplete="new-password"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setResetando(null);
                  setNovaSenha("");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={resetSenha} loading={enviando}>
                Atualizar senha
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
