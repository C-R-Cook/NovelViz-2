import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Partner Dashboard | NovelViz",
};

export default async function PartnerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl border border-zinc-800/90 bg-gradient-to-b from-zinc-950 to-zinc-900 p-6 shadow-xl shadow-black/40 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/70">
          Partner
        </p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Partner Dashboard
        </h1>
        <p className="mt-3 text-zinc-300">Partner features coming soon.</p>
        <p className="mt-6 text-sm text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-200">{user.name ?? user.email}</span>
        </p>
        <Link
          href="/books"
          className="mt-8 inline-flex rounded-md border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:border-amber-600/70 hover:bg-amber-200/90 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:border-amber-600/60 dark:hover:bg-amber-950/50"
        >
          Back to books
        </Link>
      </section>
    </div>
  );
}
