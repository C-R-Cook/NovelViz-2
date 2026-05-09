import { BookStatsClient } from "./book-stats-client";
import { getCurrentUser } from "@/lib/auth";
import { fetchPartnerBookAnalytics } from "@/lib/partner-book-analytics";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Book statistics | NovelViz",
};

type PageProps = { params: Promise<{ id: string }> };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function normalizeFromParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  // Allow only app-internal absolute paths.
  if (!value.startsWith("/")) return null;
  return value;
}

export default async function PartnerBookStatsPage({
  params,
  searchParams,
}: PageProps & { searchParams?: SearchParams }) {
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

  const sp = searchParams ? await searchParams : {};
  const from = normalizeFromParam(sp.from);
  const backHref = from ?? `/partner/books/${id}`;

  return <BookStatsClient data={data} backHref={backHref} />;
}
