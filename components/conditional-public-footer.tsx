"use client";

import { usePathname } from "next/navigation";
import { PublicFooter } from "@/components/public-footer";

/** Home landing includes its own footer; skip the global one. */
export function ConditionalPublicFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <PublicFooter />;
}
