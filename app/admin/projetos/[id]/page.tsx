import ProjectDashboard from "@/components/projects/ProjectDashboard";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function AdminProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectDashboard mode="admin" initialProjectId={id} />;
}
