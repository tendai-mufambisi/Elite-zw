import { useLoaderData } from "@tanstack/react-router";
import { useMemo } from "react";

import { site } from "@/data/content";
import { getImage, type ImageSlot } from "@/data/images";
import {
  FALLBACK_SITE_DATA,
  phoneHref,
  whatsappUrl,
  type ProjectRecord,
  type SiteData,
} from "@/data/site-data";

/** Owner-editable data, read once by the root loader and shared by every component. */
export function useSiteData(): SiteData {
  const data = useLoaderData({ from: "__root__" }) as SiteData | undefined;
  return data ?? FALLBACK_SITE_DATA;
}

export function useContact() {
  const { contact } = useSiteData();
  return {
    ...contact,
    phoneHref: phoneHref(contact.phone),
    /** WhatsApp chat link, pre-filled with the general quote request unless told otherwise. */
    whatsappLink: (text: string = site.quoteText) => whatsappUrl(contact.whatsapp, text),
  };
}

/**
 * Resolve an image slot: uploaded project photos and the founder photo come from the
 * site data, everything else from images.ts.
 */
export function useImageLookup(): (slot: string) => ImageSlot {
  const { projects, founder } = useSiteData();
  return useMemo(() => {
    const live = new Map<string, ImageSlot>();
    for (const p of projects) {
      if (p.kind === "photo") {
        live.set(p.slot, {
          slot: p.slot,
          src: p.src,
          alt: p.alt,
          width: p.width,
          height: p.height,
        });
      }
    }
    if (founder.photo) live.set("founder", founder.photo);
    return (slot: string) => live.get(slot) ?? getImage(slot);
  }, [projects, founder]);
}

/** The six home grid photos, topped up with other visible photos if any were hidden. */
export function useMosaic(): ProjectRecord[] {
  const { projects, mosaic } = useSiteData();
  return useMemo(() => {
    const photos = projects.filter((p) => p.kind === "photo");
    const chosen = mosaic
      .map((id) => photos.find((p) => p.id === id))
      .filter((p): p is ProjectRecord => !!p);
    for (const p of photos) {
      if (chosen.length >= 6) break;
      if (!chosen.includes(p)) chosen.push(p);
    }
    return chosen.slice(0, 6);
  }, [projects, mosaic]);
}
