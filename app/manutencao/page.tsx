import MaintenanceFeed from "@/components/maintenance/MaintenanceFeed";

export const dynamic = "force-dynamic";

export default function MaintenancePage() {
  return <MaintenanceFeed mode="manutencao" showComposer={false} />;
}
