import { DevRoleSwitcher } from "@/components/dev-role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200/90 bg-white/90 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:gap-6 sm:px-6">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-amber-900 dark:text-amber-100/95"
          >
            NovelViz
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/books"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-200/90"
            >
              Books
            </Link>
            <DevRoleSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
