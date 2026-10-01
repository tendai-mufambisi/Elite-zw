import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { AdminCard, AdminShell } from "@/components/admin/AdminShell";
import { errorText, imageForm, prepareImage } from "@/components/admin/prepare-image";
import {
  adminGetSettings,
  removeFounderPhoto,
  saveSettings,
  uploadFounderPhoto,
} from "@/data/admin";
import { changeAdminPassword, checkAuth } from "@/data/auth";
import { getImage } from "@/data/images";
import { adminSeo } from "@/lib/admin-seo";

export const Route = createFileRoute("/admin/settings")({
  loader: async () => {
    if (!(await checkAuth())) throw redirect({ to: "/admin/login" });
    return adminGetSettings();
  },
  head: () => adminSeo("Settings"),
  component: SettingsAdmin,
});

/** Inline success / error line under a form. */
function Feedback({ error, saved }: { error: string; saved: string }) {
  if (error) {
    return (
      <p role="alert" className="admin-error">
        {error}
      </p>
    );
  }
  return saved ? (
    <p role="status" className="admin-success">
      {saved}
    </p>
  ) : null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
      {hint && <small className="admin-muted">{hint}</small>}
    </label>
  );
}

function SettingsAdmin() {
  const { contact, founder } = Route.useLoaderData();
  const router = useRouter();

  const [form, setForm] = useState({ ...contact, founderName: founder.name });
  const [state, setState] = useState({ busy: false, error: "", saved: "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setState({ busy: true, error: "", saved: "" });
    try {
      await saveSettings({ data: form });
      await router.invalidate();
      setState({ busy: false, error: "", saved: "Saved. The website is updated." });
    } catch (e) {
      setState({ busy: false, error: errorText(e), saved: "" });
    }
  }

  return (
    <AdminShell
      title="Settings"
      description="Contact details show in the header, footer, contact page and every WhatsApp button."
    >
      <form onSubmit={saveDetails} className="admin-editor">
        <AdminCard title="Contact details">
          <div className="admin-form">
            <Field label="Phone number" hint="Shown on the site exactly as typed.">
              <input required value={form.phone} onChange={set("phone")} inputMode="tel" />
            </Field>
            <Field
              label="WhatsApp number"
              hint="With the country code, e.g. 27 84 258 6400 or 263 77 123 4567."
            >
              <input required value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
            </Field>
            <Field label="Email">
              <input required type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Facebook page link">
              <input type="url" value={form.facebook} onChange={set("facebook")} />
            </Field>
          </div>
        </AdminCard>

        <AdminCard
          title="Founder"
          description="Shown in “Meet the founder” on the home and about pages. Leave the name empty to hide that section."
        >
          <div className="admin-form">
            <Field label="Founder's name">
              <input value={form.founderName} onChange={set("founderName")} maxLength={80} />
            </Field>
          </div>
        </AdminCard>

        <Feedback error={state.error} saved={state.saved} />
        <div className="admin-actions">
          <button type="submit" disabled={state.busy} className="admin-btn admin-btn-primary">
            {state.busy ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>

      <FounderPhoto current={founder.photo?.src ?? null} />
      <ChangePassword />
    </AdminShell>
  );
}

function FounderPhoto({ current }: { current: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState({ busy: false, error: "", saved: "" });
  const shown = current ?? getImage("founder").src;

  async function upload(file: File | undefined) {
    if (!file) return;
    setState({ busy: true, error: "", saved: "" });
    try {
      await uploadFounderPhoto({ data: imageForm(await prepareImage(file)) });
      await router.invalidate();
      setState({ busy: false, error: "", saved: "Photo updated." });
    } catch (e) {
      setState({ busy: false, error: errorText(e), saved: "" });
    }
  }

  async function remove() {
    if (!window.confirm("Remove the founder photo and go back to the placeholder?")) return;
    setState({ busy: true, error: "", saved: "" });
    try {
      await removeFounderPhoto();
      await router.invalidate();
      setState({ busy: false, error: "", saved: "Photo removed." });
    } catch (e) {
      setState({ busy: false, error: errorText(e), saved: "" });
    }
  }

  return (
    <AdminCard
      title="Founder photo"
      description={current ? undefined : "Currently a placeholder picture."}
    >
      <div className="admin-photo admin-photo-small">
        <img src={shown} alt="" className="admin-photo-preview" />
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="admin-actions">
          <button
            type="button"
            className="admin-btn"
            disabled={state.busy}
            onClick={() => input.current?.click()}
          >
            {state.busy ? "Working…" : current ? "Replace photo" : "Upload photo"}
          </button>
          {current && (
            <button type="button" className="admin-btn" disabled={state.busy} onClick={remove}>
              Remove
            </button>
          )}
        </div>
        <Feedback error={state.error} saved={state.saved} />
      </div>
    </AdminCard>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState({ busy: false, error: "", saved: "" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState({ busy: true, error: "", saved: "" });
    try {
      const result = await changeAdminPassword({ data: { current, next } });
      if (result.ok) {
        setCurrent("");
        setNext("");
        setState({ busy: false, error: "", saved: "Password changed." });
      } else {
        setState({
          busy: false,
          error: result.error ?? "Could not change the password.",
          saved: "",
        });
      }
    } catch (e) {
      setState({ busy: false, error: errorText(e), saved: "" });
    }
  }

  return (
    <AdminCard title="Change password">
      <form onSubmit={onSubmit} className="admin-form">
        <Field label="Current password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Feedback error={state.error} saved={state.saved} />
        <div className="admin-actions">
          <button type="submit" disabled={state.busy} className="admin-btn admin-btn-primary">
            {state.busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
