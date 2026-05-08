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
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      <Nav />
      <main className="flex-1 pt-14">{children}</main>
    </div>
  );
}
