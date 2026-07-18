import type { UserRole } from "@/lib/types";

export function defaultRouteForRole(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "gestor") return "/gestor";
  if (role === "manutencao") return "/manutencao";
  return "/sincronizar";
}

export function safeReturnPath(value: string) {
  const from = value.trim();
  if (!from.startsWith("/") || from.startsWith("//")) return null;

  const pathname = from.split(/[?#]/, 1)[0];
  if (pathname === "/login" || pathname === "/catalogo") return null;
  return from;
}
