import { Nav } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { redirect } from "next/navigation";

export default async function PartnerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.role === UserRole.reader) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Nav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
