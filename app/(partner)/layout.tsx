import { Nav } from "@/components/nav";
import { getCurrentUser, getRoleHomeUrl } from "@/lib/auth";
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
    redirect(getRoleHomeUrl(user.role));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      <Nav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
