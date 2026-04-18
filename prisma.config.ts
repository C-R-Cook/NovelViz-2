import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Load the same env files Next.js uses (`.env.local` overrides `.env`).
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function datasourceUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();
  if (direct) return direct;
  if (pooled) return pooled;
  // `prisma generate` does not connect; satisfies config validation without a real DB URL.
  return "postgresql://127.0.0.1:5432/postgres";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
