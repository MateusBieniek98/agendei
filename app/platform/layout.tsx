import { requirePlatformAdmin } from "@/lib/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin({ requireMfa: true });
  return children;
}
