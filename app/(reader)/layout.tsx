import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Nav />
      <main>{children}</main>
    </div>
  );
}
