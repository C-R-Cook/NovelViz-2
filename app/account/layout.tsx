import { enforceAccountAccessForPage } from "@/lib/account-status-routing";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await enforceAccountAccessForPage();
  return children;
}
