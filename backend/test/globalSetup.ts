import { runner } from 'node-pg-migrate';

export default async function setup() {
  await runner({
    databaseUrl: process.env.DATABASE_URL!,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    logger: { info: () => {}, warn: console.warn, error: console.error },
  });
}
