import { EditUser } from "@/components/admin/edit-user";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditUser userId={id} />;
}
