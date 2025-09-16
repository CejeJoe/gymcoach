import { defineConfig } from "drizzle-kit";
import type { Config } from "drizzle-kit";
import 'dotenv/config';

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
}) satisfies Config;
