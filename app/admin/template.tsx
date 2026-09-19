import PageTransition from "@/components/ui/PageTransition";

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
