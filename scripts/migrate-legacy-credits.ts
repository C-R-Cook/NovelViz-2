/**
 * One-time script: migrate legacy PURCHASE UserGrant balances to CreditTransaction ledger.
 * Run: npx tsx scripts/migrate-legacy-credits.ts
 */
import { migrateLegacyPurchaseGrants } from "@/lib/stripe";

async function main() {
  const count = await migrateLegacyPurchaseGrants();
  console.log(`Migrated ${count} legacy grant(s) to credit ledger.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
