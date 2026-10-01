import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AdminCard, AdminShell, ProjectThumb } from "@/components/admin/AdminShell";
import { errorText } from "@/components/admin/prepare-image";
import { adminGetHomeGrid, adminListProjects, saveHomeGrid } from "@/data/admin";
import { checkAuth } from "@/data/auth";
import { mosaicTiles, type ProjectRecord } from "@/data/site-data";
import { adminSeo } from "@/lib/admin-seo";

export const Route = createFileRoute("/admin/home-grid")({
  loader: async () => {
    if (!(await checkAuth())) throw redirect({ to: "/admin/login" });
    const [projects, grid] = await Promise.all([adminListProjects(), adminGetHomeGrid()]);
    return { projects, grid };
  },
  head: () => adminSeo("Home grid"),
  component: HomeGridAdmin,
});

/** Orientation of a photo, to suggest which tiles it suits. */
const shape = (p: ProjectRecord) => {
  const r = p.width / p.height;
  return r > 1.4 ? "Wide" : r < 0.85 ? "Tall" : "Square-ish";
};

function HomeGridAdmin() {
  const { projects, grid } = Route.useLoaderData();
  const router = useRouter();
  const photos = projects.filter((p) => p.kind === "photo" && !p.hidden);

  const [ids, setIds] = useState<number[]>(() => {
    const valid = grid.filter((id) => photos.some((p) => p.id === id));
    for (const p of photos) if (valid.length < 6 && !valid.includes(p.id)) valid.push(p.id);
    return valid.slice(0, 6);
  });
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const photo = (id: number | undefined) => photos.find((p) => p.id === id);

  function pick(id: number) {
    if (picking === null) return;
    setIds((current) => {
      const next = [...current];
      // Picking a photo already in another tile swaps the two.
      const existing = next.indexOf(id);
      if (existing !== -1) next[existing] = next[picking]!;
      next[picking] = id;
      return next;
    });
    setPicking(null);
    setSaved("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await saveHomeGrid({ data: ids });
      await router.invalidate();
      setSaved("Saved. The home page is updated.");
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  return (
    <AdminShell
      title="Home grid"
      description="The six photos in the “Recent projects” section of the home page. Tap a tile to change its photo."
      actions={
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save grid"}
        </button>
      }
    >
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="admin-success">
          {saved}
        </p>
      )}

      <AdminCard description="Each tile shows how the photo will be cropped on a computer screen. Wide tiles suit landscape photos; tall tiles suit portrait photos.">
        <ol className="admin-grid-preview">
          {mosaicTiles.map((tile, i) => {
            const p = photo(ids[i]);
            return (
              <li key={i} className={`admin-tile admin-tile-${i + 1}`}>
                <button
                  type="button"
                  aria-pressed={picking === i}
                  onClick={() => setPicking(picking === i ? null : i)}
                >
                  {p && <img src={p.src} alt="" />}
                  <span className="admin-tile-label">
                    {i + 1}. {tile.label}
                    <small>{p ? p.caption : "Choose a photo"}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </AdminCard>

      {picking !== null && (
        <AdminCard
          title={`Choose a photo for tile ${picking + 1} (${mosaicTiles[picking]!.label})`}
          description={mosaicTiles[picking]!.hint}
          actions={
            <button type="button" className="admin-btn" onClick={() => setPicking(null)}>
              Cancel
            </button>
          }
        >
          <ul className="admin-picker">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  aria-current={ids[picking] === p.id}
                >
                  <ProjectThumb project={p} />
                  <span>{p.caption}</span>
                  <small>
                    {shape(p)}
                    {ids.includes(p.id) && ` · In tile ${ids.indexOf(p.id) + 1}`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
    </AdminShell>
  );
}
