import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-amber-100/95"
          >
            NovelViz
          </Link>
          <Link
            href="/books"
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-amber-200/90"
          >
            Books
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
