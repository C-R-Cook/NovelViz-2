import { Nav } from "@/components/nav";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Nav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
