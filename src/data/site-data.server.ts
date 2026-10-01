import { getDb, getMedia } from "./bindings.server";
import {
  categories,
  FALLBACK_SITE_DATA,
  type ContactSettings,
  type FounderSettings,
  type ProjectRecord,
  type SiteData,
} from "./site-data";
import type { ProjectCategory } from "./content";

export type ProjectRow = {
  id: number;
  slot: string;
  kind: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  category: string;
  services: string;
  hidden: number;
};

export const PROJECT_COLUMNS = `id, slot, kind, src, width, height, alt, caption, category, services, hidden`;

export function toProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    slot: row.slot,
    kind: row.kind === "video" ? "video" : "photo",
    src: row.src,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    category: (categories as readonly string[]).includes(row.category)
      ? (row.category as ProjectCategory)
      : categories[0]!,
    services: row.services.split("\n").filter(Boolean),
    hidden: row.hidden === 1,
  };
}

export async function readSettings(): Promise<Map<string, string>> {
  const { results } = await getDb()
    .prepare(`SELECT key, value FROM settings WHERE key <> 'admin_password_hash'`)
    .all<{ key: string; value: string }>();
  return new Map(results.map((row) => [row.key, row.value]));
}

export async function writeSettings(entries: [string, string][]): Promise<void> {
  const db = getDb();
  await db.batch(
    entries.map(([key, value]) =>
      db
        .prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .bind(key, value),
    ),
  );
}

/** Empty settings mean "not configured": keep the fallback for that field. */
export function contactFrom(settings: Map<string, string>): ContactSettings {
  const fallback = FALLBACK_SITE_DATA.contact;
  return {
    phone: settings.get("phone") || fallback.phone,
    whatsapp: settings.get("whatsapp") || fallback.whatsapp,
    email: settings.get("email") || fallback.email,
    facebook: settings.get("facebook") || fallback.facebook,
  };
}

export function founderFrom(settings: Map<string, string>): FounderSettings {
  let photo: FounderSettings["photo"] = null;
  try {
    const parsed = JSON.parse(settings.get("founder_photo") || "null") as Omit<
      NonNullable<FounderSettings["photo"]>,
      "slot"
    > | null;
    if (parsed?.src) photo = { ...parsed, slot: "founder" };
  } catch {
    // A malformed value falls back to the photo shipped with the site.
  }
  return { name: settings.get("founder_name") ?? FALLBACK_SITE_DATA.founder.name, photo };
}

export function mosaicFrom(settings: Map<string, string>): number[] {
  try {
    const ids = JSON.parse(settings.get("home_mosaic") || "[]") as unknown;
    if (Array.isArray(ids)) return ids.filter((id): id is number => Number.isInteger(id));
  } catch {
    // Fall through to the shipped grid.
  }
  return FALLBACK_SITE_DATA.mosaic;
}

export async function loadSiteData(): Promise<SiteData> {
  const db = getDb();
  const [{ results }, settings] = await Promise.all([
    db
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE hidden = 0 ORDER BY position, id`)
      .all<ProjectRow>(),
    readSettings(),
  ]);
  return {
    contact: contactFrom(settings),
    projects: results.map(toProject),
    mosaic: mosaicFrom(settings),
    founder: founderFrom(settings),
    live: true,
  };
}

/** Only R2-hosted uploads are deletable; `/images/*` files ship with the build. */
export async function deleteMediaObjects(urls: string[]): Promise<void> {
  const keys = urls
    .filter((url) => url.startsWith("/media/"))
    .map((url) => decodeURIComponent(url.slice("/media/".length)));
  if (keys.length === 0) return;

  const media = getMedia();
  await Promise.all(
    keys.map((key) =>
      media.delete(key).catch(() => {
        // A missing object is the desired end state anyway.
      }),
    ),
  );
}
