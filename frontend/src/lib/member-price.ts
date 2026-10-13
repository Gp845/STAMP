import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
let db: DatabaseSync | null = null;

function database() {
  if (db) return db;
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'posts.db'));
  db.exec('CREATE TABLE IF NOT EXISTS prices (creator TEXT PRIMARY KEY, monthly TEXT NOT NULL)');
  return db;
}

export function memberPrice(creator: string) {
  if (!ADDRESS.test(creator)) return '0';
  const row = database().prepare('SELECT monthly FROM prices WHERE creator = ?').get(creator.toLowerCase()) as
    | { monthly: string }
    | undefined;
  return row?.monthly ?? '0';
}

export function setMemberPrice(creator: string, monthly: string) {
  if (!ADDRESS.test(creator)) throw new Error('Connect a wallet first.');
  const value = Number(monthly);
  if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error('Use a price from 0 to 1000 MON a month.');
  database()
    .prepare(
      'INSERT INTO prices (creator, monthly) VALUES (?, ?) ON CONFLICT(creator) DO UPDATE SET monthly = excluded.monthly',
    )
    .run(creator.toLowerCase(), String(value));
}
