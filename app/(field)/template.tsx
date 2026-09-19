import PageTransition from "@/components/ui/PageTransition";

export default function FieldTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
