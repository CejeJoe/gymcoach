import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const MYSQL_HOST = process.env.MYSQL_HOST;
  const MYSQL_USER = process.env.MYSQL_USER;
  const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
  const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
  const MYSQL_PORT = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;

  const usingDiscrete = Boolean(MYSQL_HOST && MYSQL_USER && (MYSQL_PASSWORD !== undefined) && MYSQL_DATABASE);

  const { drizzle } = await import('drizzle-orm/mysql2');
  const mysql = await import('mysql2/promise');

  const pool = usingDiscrete
    ? mysql.createPool({ host: MYSQL_HOST, user: MYSQL_USER, password: MYSQL_PASSWORD, database: MYSQL_DATABASE, port: MYSQL_PORT, waitForConnections: true, connectionLimit: 10 })
    : mysql.createPool(DATABASE_URL as any);

  const db = drizzle(pool);

  console.log('Running migrations to ./migrations ...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Migrations complete.');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
