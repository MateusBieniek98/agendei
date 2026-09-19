import PageTransition from "@/components/ui/PageTransition";

export default function LoginTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
