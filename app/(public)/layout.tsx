import { Nav } from "@/components/nav";
import { enforceAccountAccessForRestrictedPages } from "@/lib/account-status-routing";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await enforceAccountAccessForRestrictedPages();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base text-text-primary antialiased">
      <Nav />
      <main className="flex-1 pt-14">{children}</main>
    </div>
  );
}
