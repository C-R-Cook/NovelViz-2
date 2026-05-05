import { BookStatsClient } from "./book-stats-client";
import { getCurrentUser } from "@/lib/auth";
import { fetchPartnerBookAnalytics } from "@/lib/partner-book-analytics";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Book statistics | NovelViz",
};

type PageProps = { params: Promise<{ id: string }> };

export default async function PartnerBookStatsPage({ params }: PageProps) {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/sign-in");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.id } });
  if (!dbUser) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const data = await fetchPartnerBookAnalytics(id, dbUser.id);
  if (!data) {
    notFound();
  }

  return <BookStatsClient data={data} />;
}
