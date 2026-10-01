import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Images, LayoutGrid, Phone, Plus } from "lucide-react";

import { AdminCard, AdminShell, ProjectThumb } from "@/components/admin/AdminShell";
import { adminListProjects } from "@/data/admin";
import { checkAuth } from "@/data/auth";
import { adminSeo } from "@/lib/admin-seo";

export const Route = createFileRoute("/admin/")({
  loader: async () => {
    if (!(await checkAuth())) throw redirect({ to: "/admin/login" });
    return { projects: await adminListProjects() };
  },
  head: () => adminSeo("Dashboard"),
  component: Dashboard,
});

function Dashboard() {
  const { projects } = Route.useLoaderData();
  const visible = projects.filter((p) => !p.hidden);
  const photos = visible.filter((p) => p.kind === "photo").length;
  const hidden = projects.length - visible.length;

  return (
    <AdminShell
      title="Dashboard"
      description="Everything here shows on the website the moment you save. No redeploy needed."
    >
      <div className="admin-stats">
        <Link to="/admin/projects" className="admin-stat">
          <Images aria-hidden="true" />
          <strong>{visible.length}</strong>
          <span>
            Projects on the website ({photos} photos, {visible.length - photos} videos)
            {hidden > 0 && `, ${hidden} hidden`}
          </span>
        </Link>
        <Link to="/admin/home-grid" className="admin-stat">
          <LayoutGrid aria-hidden="true" />
          <strong>6</strong>
          <span>Photos in the home page grid</span>
        </Link>
        <Link to="/admin/settings" className="admin-stat">
          <Phone aria-hidden="true" />
          <strong>Contact</strong>
          <span>Phone, WhatsApp, email and founder</span>
        </Link>
      </div>

      <div className="admin-two-col">
        <AdminCard
          title="Projects page, first in line"
          actions={
            <Link to="/admin/projects" className="admin-btn">
              All projects
            </Link>
          }
        >
          {projects.length === 0 ? (
            <p className="admin-muted">No projects yet. Add the first one.</p>
          ) : (
            <ul className="admin-list">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <ProjectThumb project={p} />
                  <div className="admin-list-text">
                    <strong>{p.caption}</strong>
                    <small>
                      {p.category}
                      {p.kind === "video" && " · Video"}
                      {p.hidden && " · Hidden"}
                    </small>
                  </div>
                  <Link
                    to="/admin/projects/$id"
                    params={{ id: String(p.id) }}
                    className="admin-btn admin-btn-small"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Quick actions">
          <div className="admin-quick">
            <Link
              to="/admin/projects/$id"
              params={{ id: "new" }}
              className="admin-btn admin-btn-primary"
            >
              <Plus size={17} aria-hidden="true" /> Add a project photo
            </Link>
            <Link to="/admin/home-grid" className="admin-btn">
              Change the home page photos
            </Link>
            <Link to="/admin/settings" className="admin-btn">
              Update contact details
            </Link>
            <a href="/projects" target="_blank" rel="noreferrer" className="admin-btn">
              View the Projects page
            </a>
          </div>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
