import MaintenanceFeed from "@/components/maintenance/MaintenanceFeed";

export const dynamic = "force-dynamic";

export default function MaintenanceRequestsPage() {
  return <MaintenanceFeed mode="manutencao" showComposer={false} />;
}
