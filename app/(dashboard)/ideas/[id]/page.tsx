import { IdeaDetail } from "@/components/ideas/idea-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IdeaDetail ideaId={id} />;
}
