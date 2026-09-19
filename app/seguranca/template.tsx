import PageTransition from "@/components/ui/PageTransition";

export default function SecurityTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
