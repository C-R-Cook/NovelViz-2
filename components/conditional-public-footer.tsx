"use client";

import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";

/** Routes with app chrome (admin, reader, partner) use their own layout — no marketing footer. */
function shouldShowPublicFooter(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/partner")) return false;
  if (pathname.startsWith("/library")) return false;
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/read")) return false;
  if (pathname.startsWith("/onboarding")) return false;
  if (pathname.startsWith("/dev")) return false;
  return true;
}

export function ConditionalPublicFooter() {
  const pathname = usePathname();
  if (!shouldShowPublicFooter(pathname)) return null;
  return <PublicFooter />;
}
