import { Database } from 'bun:sqlite';
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = env.DB_PATH || './data/shows.db';

try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}

export const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// --- Types ---

export interface ShowRow {
  id: number;
  tvmaze_id: number | null;
  tmdb_id: number | null;
  name: string;
  image: string | null;
  network: string | null;
  status: string | null;
  summary: string | null;
  watching_on: string | null;
  watching_on_logo: string | null;
  added_at: string;
  last_refreshed_at: string | null;
}

export interface EpisodeRow {
  id: number;
  show_id: number;
  season: number | null;
  number: number | null;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image: string | null;
}

export interface UpcomingEpisodeRow extends EpisodeRow {
  show_name: string;
  show_image: string | null;
  network: string | null;
  watching_on: string | null;
  watching_on_logo: string | null;
  finale?: 'series' | 'season';
}

export interface NextEpisodeRow extends EpisodeRow {
  show_name: string;
  show_image: string | null;
  network: string | null;
}

export interface SeasonMaxRow {
  show_id: number;
  season: number;
  max_number: number;
  max_season: number;
}

interface PragmaColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY,
    tvmaze_id INTEGER UNIQUE,
    tmdb_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    image TEXT,
    network TEXT,
    status TEXT,
    summary TEXT,
    watching_on TEXT,
    watching_on_logo TEXT,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_refreshed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY,
    show_id INTEGER NOT NULL,
    season INTEGER,
    number INTEGER,
    name TEXT,
    airdate TEXT,
    airtime TEXT,
    runtime INTEGER,
    summary TEXT,
    image TEXT,
    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    UNIQUE(show_id, season, number)
  );

  CREATE INDEX IF NOT EXISTS idx_episodes_airdate ON episodes(airdate);
  CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id);
`);

// --- Migration from v0 schema ---

const showCols = db.prepare<PragmaColumn, []>(`PRAGMA table_info(shows)`).all();
const showColNames = showCols.map((c) => c.name);
const needsShowMigration = !showColNames.includes('tmdb_id');

if (needsShowMigration) {
  db.exec(`
    CREATE TABLE shows_new (
      id INTEGER PRIMARY KEY,
      tvmaze_id INTEGER UNIQUE,
      tmdb_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      image TEXT,
      network TEXT,
      status TEXT,
      summary TEXT,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_refreshed_at TEXT
    );
    INSERT INTO shows_new (id, tvmaze_id, name, image, network, status, summary, added_at, last_refreshed_at)
      SELECT id, tvmaze_id, name, image, network, status, summary, added_at, last_refreshed_at FROM shows;
    DROP TABLE shows;
    ALTER TABLE shows_new RENAME TO shows;
  `);
}

const epCols = db.prepare<PragmaColumn, []>(`PRAGMA table_info(episodes)`).all();
if (epCols.some((c) => c.name === 'tvmaze_id')) {
  db.exec(`
    CREATE TABLE episodes_new (
      id INTEGER PRIMARY KEY,
      show_id INTEGER NOT NULL,
      season INTEGER,
      number INTEGER,
      name TEXT,
      airdate TEXT,
      airtime TEXT,
      runtime INTEGER,
      summary TEXT,
      image TEXT,
      FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
      UNIQUE(show_id, season, number)
    );
    INSERT OR IGNORE INTO episodes_new (id, show_id, season, number, name, airdate, airtime, runtime, summary, image)
      SELECT id, show_id, season, number, name, airdate, airtime, runtime, summary, image FROM episodes;
    DROP TABLE episodes;
    ALTER TABLE episodes_new RENAME TO episodes;
    CREATE INDEX IF NOT EXISTS idx_episodes_airdate ON episodes(airdate);
    CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id);
  `);
}

// watching_on column migration
const currentShowCols = db.prepare<PragmaColumn, []>(`PRAGMA table_info(shows)`).all().map((c) => c.name);
if (!currentShowCols.includes('watching_on')) {
  db.exec(`ALTER TABLE shows ADD COLUMN watching_on TEXT`);
}
if (!currentShowCols.includes('watching_on_logo')) {
  db.exec(`ALTER TABLE shows ADD COLUMN watching_on_logo TEXT`);
}

// drop service_mappings if it exists (replaced by watching_on)
try { db.exec(`DROP TABLE IF EXISTS service_mappings`); } catch {}

// --- Prepared Statements ---

export const stmt = {
  // Shows
  insertShow: db.prepare<ShowRow, any[]>(`
    INSERT INTO shows (tvmaze_id, tmdb_id, name, image, network, status, summary, watching_on, watching_on_logo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tvmaze_id) DO UPDATE SET
      tmdb_id=COALESCE(excluded.tmdb_id, tmdb_id),
      name=excluded.name, image=excluded.image, network=excluded.network,
      status=excluded.status, summary=excluded.summary,
      watching_on=COALESCE(excluded.watching_on, watching_on),
      watching_on_logo=COALESCE(excluded.watching_on_logo, watching_on_logo)
    RETURNING *
  `),
  insertShowByTmdb: db.prepare<ShowRow, any[]>(`
    INSERT INTO shows (tvmaze_id, tmdb_id, name, image, network, status, summary, watching_on, watching_on_logo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tmdb_id) DO UPDATE SET
      tvmaze_id=COALESCE(excluded.tvmaze_id, tvmaze_id),
      name=excluded.name, image=excluded.image, network=excluded.network,
      status=excluded.status, summary=excluded.summary,
      watching_on=COALESCE(excluded.watching_on, watching_on),
      watching_on_logo=COALESCE(excluded.watching_on_logo, watching_on_logo)
    RETURNING *
  `),
  deleteShow: db.prepare<void, [number]>(`DELETE FROM shows WHERE id = ?`),
  deleteShowByTvmaze: db.prepare<void, [number]>(`DELETE FROM shows WHERE tvmaze_id = ?`),
  deleteShowByTmdb: db.prepare<void, [number]>(`DELETE FROM shows WHERE tmdb_id = ?`),
  getShow: db.prepare<ShowRow, [number]>(`SELECT * FROM shows WHERE tvmaze_id = ?`),
  getShowByTmdb: db.prepare<ShowRow, [number]>(`SELECT * FROM shows WHERE tmdb_id = ?`),
  getShowById: db.prepare<ShowRow, [number]>(`SELECT * FROM shows WHERE id = ?`),
  listShows: db.prepare<ShowRow, []>(`SELECT * FROM shows ORDER BY name ASC`),
  setTvmazeId: db.prepare<void, [number, number]>(`UPDATE shows SET tvmaze_id = ? WHERE id = ?`),

  // Episodes
  upsertEpisode: db.prepare<void, any[]>(`
    INSERT INTO episodes (show_id, season, number, name, airdate, airtime, runtime, summary, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(show_id, season, number) DO UPDATE SET
      name=excluded.name, airdate=excluded.airdate, airtime=excluded.airtime,
      runtime=excluded.runtime, summary=excluded.summary, image=excluded.image
  `),
  deleteEpisodesForShow: db.prepare<void, [number]>(`DELETE FROM episodes WHERE show_id = ?`),

  // Queries
  upcomingEpisodes: db.prepare<UpcomingEpisodeRow, []>(`
    SELECT e.*, s.name AS show_name, s.image AS show_image, s.network, s.watching_on, s.watching_on_logo
    FROM episodes e
    JOIN shows s ON s.id = e.show_id
    WHERE e.airdate >= date('now', '-1 day')
    ORDER BY e.airdate ASC, e.airtime ASC
  `),
  nextEpPerShow: db.prepare<NextEpisodeRow, []>(`
    SELECT e.*, s.name AS show_name, s.image AS show_image, s.network
    FROM episodes e
    JOIN shows s ON s.id = e.show_id
    WHERE e.airdate >= date('now', '-1 day')
    AND e.id = (
      SELECT e2.id FROM episodes e2
      WHERE e2.show_id = s.id AND e2.airdate >= date('now', '-1 day')
      ORDER BY e2.airdate ASC, e2.airtime ASC
      LIMIT 1
    )
    ORDER BY e.airdate ASC
  `),
  markRefreshed: db.prepare<void, [number]>(`UPDATE shows SET last_refreshed_at = CURRENT_TIMESTAMP WHERE id = ?`),
  seasonMaxEpisodes: db.prepare<SeasonMaxRow, []>(`
    SELECT show_id, season, MAX(number) as max_number, MAX(season) OVER (PARTITION BY show_id) as max_season
    FROM episodes GROUP BY show_id, season
  `),

  // Show detail
  episodesByShow: db.prepare<EpisodeRow, [number]>(`
    SELECT * FROM episodes WHERE show_id = ? ORDER BY season ASC, number ASC
  `)
};
