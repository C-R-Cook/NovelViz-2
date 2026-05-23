// TODO: deprecated — functionality moved to /dashboard tabs
import "./admin-mobile.css";
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
    redirect(getRoleHomeUrl());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      <Nav />
      <main className="admin-layout-main mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-[5.5rem] sm:px-6 sm:pb-8">
        {children}
      </main>
    </div>
  );
}
