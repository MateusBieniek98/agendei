import { requirePlatformAdmin } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin({ requireMfa: true });
  return <ToastProvider>{children}</ToastProvider>;
}
