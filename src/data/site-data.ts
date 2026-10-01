// The owner-editable part of the site: project photos, the home "Recent projects" grid,
// contact details and the founder. D1 holds the live copy; everything here is the
// FALLBACK built from content.ts/images.ts, used when D1 is unreachable and as the
// source for the seed migration (scripts/gen-seed.ts), so the two never drift apart.
// Pure module: no server imports, safe in the browser.

import {
  founder,
  home,
  projectCategories,
  projects,
  services,
  site,
  type ProjectCategory,
} from "./content";
import { getImage, getVideo } from "./images";

export type ProjectKind = "photo" | "video";

export type ProjectRecord = {
  id: number;
  /** Image key used by <Media>. Seeded rows keep their images.ts slot; uploads get "upload-…". */
  slot: string;
  kind: ProjectKind;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  category: ProjectCategory;
  /** Service slugs whose gallery shows this photo. */
  services: string[];
  hidden: boolean;
};

export type PhotoData = { src: string; width: number; height: number; alt: string };

export type ContactSettings = {
  phone: string;
  /** Digits only, international format without "+", e.g. 27842586400. */
  whatsapp: string;
  email: string;
  facebook: string;
};

export type FounderSettings = {
  name: string;
  /** null = keep the photo that ships with the site. */
  photo: (PhotoData & { slot: string }) | null;
};

export type SiteData = {
  contact: ContactSettings;
  /** Visible projects only, in display order. */
  projects: ProjectRecord[];
  /** Project ids for the six home grid tiles, in tile order. */
  mosaic: number[];
  founder: FounderSettings;
  /** False when this is the fallback (D1 unreachable or not configured). */
  live: boolean;
};

export const categories = projectCategories.filter((c): c is ProjectCategory => c !== "All");

/** Shapes of the six home grid tiles (see .mosaic-1 … .mosaic-6 in styles.css). */
export const mosaicTiles = [
  { label: "Large", hint: "Big square-ish tile, top left", ratio: 1.15 },
  { label: "Tall", hint: "Portrait photos fit best", ratio: 0.57 },
  { label: "Tall", hint: "Portrait photos fit best", ratio: 0.57 },
  { label: "Wide", hint: "Landscape photos fit best", ratio: 2.35 },
  { label: "Small", hint: "Square-ish tile", ratio: 1.15 },
  { label: "Small", hint: "Square-ish tile", ratio: 1.15 },
] as const;

/* ---------- fallback (mirrors migration 0002) ---------- */

export const FALLBACK_CONTACT: ContactSettings = {
  phone: site.phone,
  whatsapp: site.whatsappNumber,
  email: site.email,
  facebook: site.facebook,
};

export function buildFallbackProjects(): ProjectRecord[] {
  return projects.map((p, i) => {
    const media = p.video ? getVideo(p.slot) : getImage(p.slot);
    return {
      id: i + 1,
      slot: p.slot,
      kind: p.video ? "video" : "photo",
      src: media.src,
      width: media.width,
      height: media.height,
      alt: "alt" in media ? media.alt : media.title,
      caption: p.caption,
      category: p.category,
      services: p.video
        ? []
        : services
            .filter((s) => (s.gallery as readonly string[]).includes(p.slot))
            .map((s) => s.slug),
      hidden: false,
    };
  });
}

const fallbackProjects = buildFallbackProjects();

export const FALLBACK_MOSAIC: number[] = home.mosaic.map(
  (slot) => fallbackProjects.find((p) => p.slot === slot)!.id,
);

export const FALLBACK_SITE_DATA: SiteData = {
  contact: FALLBACK_CONTACT,
  projects: fallbackProjects,
  mosaic: FALLBACK_MOSAIC,
  founder: { name: founder.name, photo: null },
  live: false,
};

/* ---------- helpers shared by the site and the dashboard ---------- */

export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const whatsappUrl = (number: string, text?: string) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Every project slot in the shipped content, so galleries can tell project photos apart. */
const seededProjectSlots = new Set(fallbackProjects.map((p) => p.slot));

/**
 * A service gallery: the photos listed in content.ts, minus project photos the owner has
 * hidden, deleted or untagged, plus any other visible photos tagged for this service.
 * Photos that are not projects (e.g. waterproofing process shots) always stay.
 */
export function galleryFor(
  service: { slug: string; gallery: readonly string[] },
  data: SiteData,
): string[] {
  const tagged = data.projects.filter(
    (p) => p.kind === "photo" && p.services.includes(service.slug),
  );
  const taggedSlots = new Set(tagged.map((p) => p.slot));
  const kept = service.gallery.filter(
    (slot) => !seededProjectSlots.has(slot) || taggedSlots.has(slot),
  );
  const added = tagged.map((p) => p.slot).filter((slot) => !kept.includes(slot));
  return [...kept, ...added];
}
