-- Owner dashboard schema. Content columns are TEXT NOT NULL DEFAULT '' so a half-filled
-- row never breaks the public site.

-- One row per item on the Projects page: a photo, or one of the shipped videos.
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Image key for <Media>: the images.ts slot for shipped photos, "upload-…" for uploads.
  slot TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo', 'video')),
  -- URL path: /images/… (shipped with the site) or /media/… (R2 upload).
  src TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  -- Service slugs whose gallery shows this photo, one per line.
  services TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX projects_position ON projects (position, id);

-- Contact details, founder, home grid and the admin password hash.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Failed sign-ins per IP, for rate limiting.
CREATE TABLE login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL DEFAULT 0
);
