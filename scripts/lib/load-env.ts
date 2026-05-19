import { config } from "dotenv";
import { resolve } from "node:path";

/** Load `.env` then `.env.local` before any other script imports (e.g. `@/lib/prisma`). */
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
