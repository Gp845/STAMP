import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { uploadedPost, type Post } from './feed';

export type StoredPost = {
  id: string;
  title: string;
  creator: string;
  createdAt: number;
  mime: string;
  c2pa: string | null;
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const MAX_IMAGE = 4_000_000;
const MAX_VIDEO = 40_000_000;

let db: DatabaseSync | null = null;

function database() {
  if (db) return db;
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'posts.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    creator TEXT NOT NULL,
    image BLOB NOT NULL,
    mime TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  const cols = db.prepare('PRAGMA table_info(posts)').all() as { name: string }[];
  if (!cols.some((col) => col.name === 'c2pa')) db.exec('ALTER TABLE posts ADD COLUMN c2pa TEXT');
  return db;
}

export function mediaKind(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const mark = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (mark === 'WEBP') return 'image/webp';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'video/mp4';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  return '';
}

export function listPosts(): StoredPost[] {
  return database().prepare(
    'SELECT id, title, creator, mime, created_at AS createdAt, c2pa FROM posts ORDER BY created_at DESC',
  ).all() as StoredPost[];
}

export function getStoredPost(id: string): StoredPost | null {
  const row = database().prepare(
    'SELECT id, title, creator, mime, created_at AS createdAt, c2pa FROM posts WHERE id = ?',
  ).get(id) as StoredPost | undefined;
  return row ?? null;
}

export function postImage(id: string) {
  const row = database().prepare('SELECT mime, image FROM posts WHERE id = ?').get(id) as
    | { mime: string; image: Uint8Array }
    | undefined;
  return row ?? null;
}

export function insertPost(title: string, creator: string, file: Uint8Array, c2pa: string | null = null) {
  const cleanTitle = title.trim();
  if (!cleanTitle || cleanTitle.length > 140) throw new Error('Give the post a title.');
  if (!ADDRESS.test(creator)) throw new Error('Connect a wallet before uploading.');
  const mime = mediaKind(file);
  if (!mime) throw new Error('Upload a PNG, JPEG, GIF, WebP, MP4, or WebM.');
  const limit = mime.startsWith('video/') ? MAX_VIDEO : MAX_IMAGE;
  if (file.length === 0 || file.length > limit) {
    throw new Error(mime.startsWith('video/') ? 'Use a video under 40 MB.' : 'Use an image under 4 MB.');
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  database().prepare(
    'INSERT INTO posts (id, title, creator, image, mime, created_at, c2pa) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, cleanTitle, creator.toLowerCase(), file, mime, Date.now(), c2pa);
  return id;
}

export function toFeedPost(row: StoredPost): Post {
  return uploadedPost(row);
}
