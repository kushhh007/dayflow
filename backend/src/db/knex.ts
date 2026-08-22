import knex, { type Knex } from 'knex';
// @ts-ignore — knexfile.js is plain JS (Member 2 domain runtime)
import config from '../../knexfile.js';

export const db: Knex = knex(config);
export default db;
