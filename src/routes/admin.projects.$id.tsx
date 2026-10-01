import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import { ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { AdminCard, AdminShell, ProjectThumb } from "@/components/admin/AdminShell";
import {
  errorText,
  imageForm,
  prepareImage,
  type PreparedImage,
} from "@/components/admin/prepare-image";
import { adminGetProject, createProject, replaceProjectPhoto, saveProject } from "@/data/admin";
import { checkAuth } from "@/data/auth";
import { services } from "@/data/content";
import { categories } from "@/data/site-data";
import { adminSeo } from "@/lib/admin-seo";

// Only services that have a photo gallery on their page.
const galleryServices = services.filter((s) => s.gallery.length > 0 || s.image);

export const Route = createFileRoute("/admin/projects/$id")({
  loader: async ({ params }) => {
    if (!(await checkAuth())) throw redirect({ to: "/admin/login" });
    if (params.id === "new") return { project: null };
    const project = await adminGetProject({ data: Number(params.id) });
    if (!project) throw notFound();
    return { project };
  },
  head: ({ params }) => adminSeo(params.id === "new" ? "Add a project photo" : "Edit project"),
  component: ProjectEditor,
});

function ProjectEditor() {
  const { project } = Route.useLoaderData();
  const router = useRouter();
  const isNew = project === null;
  const isVideo = project?.kind === "video";

  const [caption, setCaption] = useState(project?.caption ?? "");
  const [category, setCategory] = useState<string>(project?.category ?? "");
  const [alt, setAlt] = useState(project && project.alt !== project.caption ? project.alt : "");
  const [tagged, setTagged] = useState<string[]>(project?.services ?? []);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    setPreparing(true);
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      setError(errorText(e));
    }
    setPreparing(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    if (isNew && !image) {
      setError("Please choose a photo first.");
      return;
    }
    setBusy(true);
    try {
      const fields = { caption, category, alt, services: tagged };
      if (isNew) {
        const { id } = await createProject({ data: imageForm(image!, fields) });
        await router.invalidate();
        await router.navigate({ to: "/admin/projects/$id", params: { id: String(id) } });
        return;
      }
      await saveProject({ data: { id: project.id, ...fields } });
      if (image) {
        await replaceProjectPhoto({ data: imageForm(image, { id: String(project.id) }) });
        setImage(null);
      }
      await router.invalidate();
      setSaved("Saved. The website is updated.");
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  const toggle = (slug: string) =>
    setTagged((t) => (t.includes(slug) ? t.filter((s) => s !== slug) : [...t, slug]));

  return (
    <AdminShell
      title={isNew ? "Add a project photo" : "Edit project"}
      description={
        isNew
          ? "Take or choose a photo of finished work. Tick the service pages it should appear on, or use it in the home grid."
          : undefined
      }
      actions={
        <Link to="/admin/projects" className="admin-btn">
          Back to projects
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="admin-editor">
        <AdminCard title={isVideo ? "Video" : "Photo"}>
          <div className="admin-photo">
            {image ? (
              <img src={image.previewUrl} alt="" className="admin-photo-preview" />
            ) : project ? (
              <ProjectThumb project={project} className="admin-photo-preview" />
            ) : (
              <button
                type="button"
                className="admin-dropzone"
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={30} aria-hidden="true" />
                {preparing ? "Preparing photo…" : "Tap to choose a photo"}
              </button>
            )}
            {isVideo ? (
              <p className="admin-muted">
                Videos can be renamed, moved or hidden here, but not replaced.
              </p>
            ) : (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  hidden
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {(image || project) && (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={preparing}
                    onClick={() => fileInput.current?.click()}
                  >
                    {preparing
                      ? "Preparing photo…"
                      : image
                        ? "Choose a different photo"
                        : "Replace photo"}
                  </button>
                )}
                <p className="admin-muted">
                  Photos are resized automatically. Use photos of real, finished jobs only.
                </p>
              </>
            )}
          </div>
        </AdminCard>

        <AdminCard title="Details">
          <div className="admin-form">
            <label className="admin-field">
              <span>Caption</span>
              <input
                required
                maxLength={140}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. Charcoal seamless gutters, double-storey"
              />
            </label>
            <label className="admin-field">
              <span>Category</span>
              <select required value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {!isVideo && (
              <fieldset className="admin-field">
                <legend>Also show on these service pages (optional)</legend>
                <div className="admin-check-grid">
                  {galleryServices.map((s) => (
                    <label key={s.slug} className="admin-check">
                      <input
                        type="checkbox"
                        checked={tagged.includes(s.slug)}
                        onChange={() => toggle(s.slug)}
                      />
                      {s.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="admin-field">
              <span>Description for Google and screen readers (optional)</span>
              <input
                maxLength={300}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Leave empty to use the caption"
              />
            </label>
          </div>
        </AdminCard>

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
        <div className="admin-actions">
          <button
            type="submit"
            disabled={busy || preparing}
            className="admin-btn admin-btn-primary"
          >
            {busy ? "Saving…" : isNew ? "Add to website" : "Save changes"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
