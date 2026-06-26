"use client";

import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";

/** Hide footer only on the immersive in-book reader shell. */
function shouldShowPublicFooter(pathname: string): boolean {
  return !pathname.startsWith("/reader/");
}

export function ConditionalPublicFooter() {
  const pathname = usePathname();
  if (!shouldShowPublicFooter(pathname)) return null;
  return <PublicFooter />;
}
