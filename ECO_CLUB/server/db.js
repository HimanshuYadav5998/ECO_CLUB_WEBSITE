import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA journal_mode = WAL;')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'member')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_uploads (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT '',
      start_time TEXT NOT NULL DEFAULT '',
      end_time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_albums (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      year INTEGER,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_photos (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      year INTEGER,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      album_id TEXT REFERENCES gallery_albums(id) ON DELETE SET NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      description TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      year INTEGER,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_before_after (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      before_url TEXT NOT NULL,
      after_url TEXT NOT NULL,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      year INTEGER,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_featured (
      id TEXT PRIMARY KEY,
      photo_id TEXT NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS impact_stats (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '🌱',
      description TEXT NOT NULL DEFAULT '',
      year INTEGER,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_awards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '',
      recipient TEXT NOT NULL DEFAULT '',
      impact_metric TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'environmental',
      year INTEGER,
      featured INTEGER NOT NULL DEFAULT 0,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_certificates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      issued_by TEXT NOT NULL DEFAULT '',
      recipient_name TEXT NOT NULL DEFAULT '',
      year INTEGER,
      image_url TEXT NOT NULL DEFAULT '',
      download_url TEXT NOT NULL DEFAULT '',
      allow_download INTEGER NOT NULL DEFAULT 1,
      download_policy TEXT NOT NULL DEFAULT 'public' CHECK (download_policy IN ('public', 'members', 'restricted')),
      download_count INTEGER NOT NULL DEFAULT 0,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_timeline (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      year INTEGER,
      category TEXT NOT NULL DEFAULT 'environmental',
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_hall_of_fame (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      year INTEGER,
      honor_badge TEXT NOT NULL DEFAULT '',
      contribution TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievement_stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'sustainability',
      year INTEGER,
      image_url TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_photos_event ON gallery_photos(event_id);
    CREATE INDEX IF NOT EXISTS idx_photos_album ON gallery_photos(album_id);
    CREATE INDEX IF NOT EXISTS idx_albums_event ON gallery_albums(event_id);
    CREATE INDEX IF NOT EXISTS idx_awards_event ON achievement_awards(event_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_event ON achievement_timeline(event_id);
  `)

  return db
}
