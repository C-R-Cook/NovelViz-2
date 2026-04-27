import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { UserRole } from "@db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/library");
  }
  if (user.role !== UserRole.admin) {
    redirect(getRoleHomeUrl(user.role));
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200/90 bg-white/90 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:gap-x-6 sm:px-6">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-amber-900 dark:text-amber-100/95"
          >
            NovelViz
          </Link>
          <Link
            href="/books"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
          >
            Books
          </Link>
          <Link
            href="/gallery"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
          >
            Gallery
          </Link>
          <Link
            href="/library"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
          >
            My Library
          </Link>
          <Link
            href="/partner/dashboard"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
          >
            Partner Dashboard
          </Link>
          <Link
            href="/admin/books"
            className="text-sm font-semibold text-amber-900 dark:text-amber-200"
          >
            Admin
          </Link>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
              Admin
            </span>
            <DevRoleSwitcher initialUserId={user.id} />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
