import PageTransition from "@/components/ui/PageTransition";

export default function PlatformTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
