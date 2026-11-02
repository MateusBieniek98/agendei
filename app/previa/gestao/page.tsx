import type { Metadata } from "next";
import ManagementPreview from "@/components/dashboard/preview/ManagementPreview";

export const metadata: Metadata = {
  title: "Prévia do painel de gestão",
  robots: { index: false, follow: false },
};

export default function ManagementPreviewPage() {
  return <ManagementPreview />;
}
