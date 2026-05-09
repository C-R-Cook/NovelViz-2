import { AdminStatsClient } from "@/components/admin/admin-stats-client";
import { getAdminStatsPayload } from "@/lib/admin-stats";

export const metadata = {
  title: "Statistics | NovelViz Admin",
};

export default async function AdminStatsPage() {
  const initialData = await getAdminStatsPayload();
  return <AdminStatsClient initialData={initialData} />;
}
