import PageTransition from "@/components/ui/PageTransition";

export default function GestorTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
