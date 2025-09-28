import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const emailArg = process.argv.find(a => a.startsWith('--email='))?.split('=')[1] || process.env.ADMIN_EMAIL;
  if (!emailArg) {
    console.error('Usage: tsx scripts/promote-admin.ts --email=user@example.com');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, emailArg));
  if (!user) {
    console.error('No user found with email:', emailArg);
    await pool.end();
    process.exit(2);
  }

  await db.update(schema.users)
    .set({ role: 'admin' as any, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  console.log('Promoted to admin:', emailArg);
  await pool.end();
}

main().catch((e) => {
  console.error('promote-admin failed:', e);
  process.exit(1);
});
