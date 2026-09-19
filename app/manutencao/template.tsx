import PageTransition from "@/components/ui/PageTransition";

export default function MaintenanceTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
