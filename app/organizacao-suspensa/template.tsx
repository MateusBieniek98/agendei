import PageTransition from "@/components/ui/PageTransition";

export default function SuspendedOrganizationTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
