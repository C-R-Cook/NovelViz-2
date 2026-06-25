import { Nav } from "@/components/nav";
import Link from "next/link";
import { requireAccountStatusForPage } from "@/lib/account-status-routing";

export default async function TerminatedAccountPage() {
  await requireAccountStatusForPage("terminated");

  return (
    <>
      <Nav />
      <main className="flex-1 pt-14">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-primary">
            Account permanently terminated
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Your account has been permanently terminated for violating our{" "}
            <Link href="/terms" className="text-accent-text underline-offset-2 hover:underline">
              Terms of Service
            </Link>{" "}
            or{" "}
            <Link href="/acceptable-use" className="text-accent-text underline-offset-2 hover:underline">
              Acceptable Use Policy
            </Link>
            . This decision is final.
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Questions?{" "}
            <Link href="/contact" className="text-accent-text underline-offset-2 hover:underline">
              Contact support
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
