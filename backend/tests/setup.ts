import { newDb } from 'pg-mem';
import type { Knex } from 'knex';
import * as migration from '../migrations/20260822000001_create_initial_domain_schema.js';

export function createTestDb(): Knex {
  const mem = newDb();
  // Register now() function if needed
  const knexInstance = mem.adapters.createKnex() as Knex;
  return knexInstance;
}

export async function runMigrations(knex: Knex): Promise<void> {
  await migration.up(knex);
}

export async function rollbackMigrations(knex: Knex): Promise<void> {
  await migration.down(knex);
}
