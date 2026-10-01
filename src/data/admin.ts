import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "./auth.server";
import { getDb, getMedia } from "./bindings.server";
import { services } from "./content";
import {
  categories,
  type ContactSettings,
  type FounderSettings,
  type ProjectRecord,
} from "./site-data";
import {
  contactFrom,
  deleteMediaObjects,
  founderFrom,
  mosaicFrom,
  PROJECT_COLUMNS,
  readSettings,
  toProject,
  writeSettings,
  type ProjectRow,
} from "./site-data.server";

/* ---------- uploads ---------- */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

type UploadedImage = { file: File; extension: string; width: number; height: number };

/** The dashboard resizes photos in the browser and sends their pixel size alongside. */
function readImage(formData: FormData): UploadedImage {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Please choose a photo.");

  const extension = IMAGE_TYPES.get(file.type);
  if (!extension) {
    throw new Error("That file type is not supported. Use JPG, PNG, WebP or AVIF.");
  }
  if (file.size === 0) throw new Error("That file appears to be empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is larger than 10 MB. Please resize it and try again.");
  }

  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));
  const valid = (n: number) => Number.isInteger(n) && n > 0 && n <= 10_000;
  if (!valid(width) || !valid(height)) throw new Error("Could not read the photo's size.");

  return { file, extension, width, height };
}

async function putImage(folder: string, image: UploadedImage): Promise<string> {
  const key = `${folder}/${crypto.randomUUID()}.${image.extension}`;
  await getMedia().put(key, await image.file.arrayBuffer(), {
    httpMetadata: { contentType: image.file.type },
  });
  // The key embeds a UUID, so the URL is immutable and safe to cache forever.
  return `/media/${key}`;
}

/** A fresh image key, so pages that use the old photo's slot elsewhere keep the old photo. */
const uploadSlot = () => `upload-${crypto.randomUUID().slice(0, 8)}`;

/* ---------- validation ---------- */

const serviceSlugs = new Set<string>(services.map((s) => s.slug));

function cleanProjectFields(input: ProjectFields) {
  const caption = input.caption.trim().slice(0, 140);
  if (!caption) throw new Error("Please add a caption.");
  if (!(categories as readonly string[]).includes(input.category)) {
    throw new Error("Please choose a category.");
  }
  return {
    caption,
    category: input.category,
    // The description for screen readers and Google defaults to the caption.
    alt: (input.alt.trim() || caption).slice(0, 300),
    services: input.services.filter((s) => serviceSlugs.has(s)).join("\n"),
  };
}

function formFields(formData: FormData): ProjectFields {
  return {
    caption: String(formData.get("caption") ?? ""),
    category: String(formData.get("category") ?? ""),
    alt: String(formData.get("alt") ?? ""),
    services: formData.getAll("services").map(String),
  };
}

const positiveId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("A valid project is required.");
  return id;
};

/* ---------- projects ---------- */

export type ProjectFields = {
  caption: string;
  category: string;
  alt: string;
  services: string[];
};

/** Admin lists are unfiltered and never fall back — the owner must see the truth. */
export const adminListProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProjectRecord[]> => {
    await requireAdmin();
    const { results } = await getDb()
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY position, id`)
      .all<ProjectRow>();
    return results.map(toProject);
  },
);

export const adminGetProject = createServerFn({ method: "GET" })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }): Promise<ProjectRecord | null> => {
    await requireAdmin();
    const row = await getDb()
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`)
      .bind(id)
      .first<ProjectRow>();
    return row ? toProject(row) : null;
  });

/** New projects are always photos: the photo and its details arrive together. */
export const createProject = createServerFn({ method: "POST" })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<{ id: number }> => {
    await requireAdmin();
    const fields = cleanProjectFields(formFields(data));
    const image = readImage(data);
    const src = await putImage("projects", image);

    const db = getDb();
    // New work goes to the top of the Projects page.
    const top = await db
      .prepare(`SELECT COALESCE(MIN(position), 1) - 1 AS pos FROM projects`)
      .first<{ pos: number }>();
    const result = await db
      .prepare(
        `INSERT INTO projects (slot, kind, src, width, height, alt, caption, category, services, hidden, position)
         VALUES (?, 'photo', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        uploadSlot(),
        src,
        image.width,
        image.height,
        fields.alt,
        fields.caption,
        fields.category,
        fields.services,
        top?.pos ?? 0,
      )
      .run();
    return { id: Number(result.meta.last_row_id) };
  });

export const saveProject = createServerFn({ method: "POST" })
  .inputValidator((input: ProjectFields & { id: number }) => input)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    const id = positiveId(data.id);
    const fields = cleanProjectFields(data);
    await getDb()
      .prepare(`UPDATE projects SET caption = ?, category = ?, alt = ?, services = ? WHERE id = ?`)
      .bind(fields.caption, fields.category, fields.alt, fields.services, id)
      .run();
  });

export const replaceProjectPhoto = createServerFn({ method: "POST" })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    const id = positiveId(data.get("id"));
    const image = readImage(data);

    const db = getDb();
    const project = await db
      .prepare(`SELECT kind, src FROM projects WHERE id = ?`)
      .bind(id)
      .first<{ kind: string; src: string }>();
    if (!project) throw new Error("That project no longer exists.");
    if (project.kind !== "photo") throw new Error("Videos can't be replaced from the dashboard.");

    const src = await putImage("projects", image);
    await db
      .prepare(`UPDATE projects SET slot = ?, src = ?, width = ?, height = ? WHERE id = ?`)
      .bind(uploadSlot(), src, image.width, image.height, id)
      .run();
    await deleteMediaObjects([project.src]);
  });

export const setProjectHidden = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; hidden: boolean }) => input)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    await getDb()
      .prepare(`UPDATE projects SET hidden = ? WHERE id = ?`)
      .bind(data.hidden ? 1 : 0, positiveId(data.id))
      .run();
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((id: number) => id)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    const id = positiveId(data);
    const db = getDb();

    const project = await db
      .prepare(`SELECT src FROM projects WHERE id = ?`)
      .bind(id)
      .first<{ src: string }>();
    if (!project) return;

    await db.prepare(`DELETE FROM projects WHERE id = ?`).bind(id).run();
    // Remove the R2 object too, or the bucket keeps paying for an orphan.
    await deleteMediaObjects([project.src]);
  });

/** Swap with the neighbour. Positions are renumbered so duplicates never block a move. */
export const moveProject = createServerFn({ method: "POST" })
  .inputValidator((input: { id: number; direction: "up" | "down" }) => input)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    const db = getDb();
    const { results } = await db
      .prepare(`SELECT id FROM projects ORDER BY position, id`)
      .all<{ id: number }>();

    const index = results.findIndex((row) => row.id === data.id);
    const target = data.direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= results.length) return;

    const order = [...results];
    [order[index], order[target]] = [order[target]!, order[index]!];
    await db.batch(
      order.map((row, i) =>
        db.prepare(`UPDATE projects SET position = ? WHERE id = ?`).bind(i + 1, row.id),
      ),
    );
  });

/* ---------- home grid ---------- */

export const adminGetHomeGrid = createServerFn({ method: "GET" }).handler(
  async (): Promise<number[]> => {
    await requireAdmin();
    return mosaicFrom(await readSettings());
  },
);

export const saveHomeGrid = createServerFn({ method: "POST" })
  .inputValidator((ids: number[]) => ids)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    if (data.length !== 6) throw new Error("The home grid needs six photos.");
    const ids = data.map(positiveId);
    if (new Set(ids).size !== ids.length) throw new Error("Use a different photo in each tile.");

    const placeholders = ids.map(() => "?").join(", ");
    const { results } = await getDb()
      .prepare(`SELECT id FROM projects WHERE kind = 'photo' AND id IN (${placeholders})`)
      .bind(...ids)
      .all<{ id: number }>();
    if (results.length !== ids.length) throw new Error("One of those photos no longer exists.");

    await writeSettings([["home_mosaic", JSON.stringify(ids)]]);
  });

/* ---------- settings ---------- */

export type AdminSettings = { contact: ContactSettings; founder: FounderSettings };

export const adminGetSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSettings> => {
    await requireAdmin();
    const settings = await readSettings();
    return { contact: contactFrom(settings), founder: founderFrom(settings) };
  },
);

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((input: ContactSettings & { founderName: string }) => input)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();

    const phone = data.phone.trim();
    if (phone.replace(/\D/g, "").length < 9) throw new Error("Please enter a full phone number.");

    // wa.me links need digits only, in international format.
    const whatsapp = data.whatsapp.replace(/\D/g, "");
    if (whatsapp.length < 9 || whatsapp.startsWith("0")) {
      throw new Error("Enter the WhatsApp number with its country code, e.g. 263 77 001 0502.");
    }

    const email = data.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email.");

    const facebook = data.facebook.trim();
    if (facebook && !/^https:\/\/(www\.|m\.)?facebook\.com\//.test(facebook)) {
      throw new Error("The Facebook link should start with https://www.facebook.com/");
    }

    await writeSettings([
      ["phone", phone],
      ["whatsapp", whatsapp],
      ["email", email],
      ["facebook", facebook],
      ["founder_name", data.founderName.trim().slice(0, 80)],
    ]);
  });

export const uploadFounderPhoto = createServerFn({ method: "POST" })
  .inputValidator((formData: FormData) => formData)
  .handler(async ({ data }): Promise<void> => {
    await requireAdmin();
    const image = readImage(data);
    const settings = await readSettings();
    const previous = founderFrom(settings).photo;
    const name = settings.get("founder_name") || "the founder";

    const src = await putImage("founder", image);
    await writeSettings([
      [
        "founder_photo",
        JSON.stringify({ src, width: image.width, height: image.height, alt: `Photo of ${name}` }),
      ],
    ]);
    if (previous) await deleteMediaObjects([previous.src]);
  });

export const removeFounderPhoto = createServerFn({ method: "POST" }).handler(
  async (): Promise<void> => {
    await requireAdmin();
    const previous = founderFrom(await readSettings()).photo;
    await writeSettings([["founder_photo", ""]]);
    if (previous) await deleteMediaObjects([previous.src]);
  },
);
