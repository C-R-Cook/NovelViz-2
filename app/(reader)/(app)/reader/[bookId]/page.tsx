import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ bookId: string }>;
};

export const metadata = {
  title: "Reader | NovelViz",
};

export default async function ReaderBookPage({ params }: PageProps) {
  const { bookId } = await params;
  redirect(`/library?book=${encodeURIComponent(bookId)}`);
}
