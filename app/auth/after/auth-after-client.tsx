"use client";

import { clearDevIdentityOnClient } from "@/lib/clear-dev-identity-client";
import { useEffect } from "react";

export function AuthAfterClient({ redirectTo }: { redirectTo: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      clearDevIdentityOnClient();
    }
    window.location.replace(redirectTo);
  }, [redirectTo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-6 text-sm text-text-muted">
      Continuing…
    </div>
  );
}
