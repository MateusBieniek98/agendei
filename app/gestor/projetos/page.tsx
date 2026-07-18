import ProjectDashboard from "@/components/projects/ProjectDashboard";
import { requireGestorShellProfile } from "../access";

export const dynamic = "force-dynamic";

export default async function GestorProjectsPage() {
  await requireGestorShellProfile();
  return <ProjectDashboard mode="gestor" />;
}
