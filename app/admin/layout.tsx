import { Nav } from "@/components/nav";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
import { UserRole } from "@db";
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
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
