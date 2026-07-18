import type { UserRole } from "@/lib/types";

export function defaultRouteForRole(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "gestor") return "/gestor";
  if (role === "manutencao") return "/manutencao";
  return "/sincronizar";
}
