import { ContentDetail } from "@/components/content/content-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContentDetail ideaId={id} />;
}
