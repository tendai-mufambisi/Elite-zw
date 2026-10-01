import { Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, Images, LayoutDashboard, LayoutGrid, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { logout } from "@/data/auth";
import { getImage } from "@/data/images";
import { getVideo } from "@/data/images";
import type { ProjectRecord } from "@/data/site-data";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/projects", label: "Projects", icon: Images, exact: false },
  { to: "/admin/home-grid", label: "Home grid", icon: LayoutGrid, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export function AdminLogo() {
  const logo = getImage("logo-main");
  return (
    <span className="admin-logo">
      <img src={logo.src} alt="" width={40} height={40} />
      <span>
        <strong>Elite Gutters</strong>
        <small>and Aluminium Products</small>
      </span>
    </span>
  );
}

/** Thumbnail for a project: the photo itself, or the poster frame of a video. */
export function ProjectThumb({
  project,
  className = "admin-thumb",
}: {
  project: ProjectRecord;
  className?: string;
}) {
  const src = project.kind === "video" ? getVideo(project.slot).poster : project.src;
  return <img className={className} src={src} alt="" loading="lazy" decoding="async" />;
}

export function AdminCard({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-card">
      {(title || actions) && (
        <header className="admin-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="admin-actions">{actions}</div>}
        </header>
      )}
      <div className="admin-card-body">{children}</div>
    </section>
  );
}

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    await logout();
    await router.navigate({ to: "/admin/login" });
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-side-head">
          <Link to="/admin">
            <AdminLogo />
          </Link>
          <p className="admin-label">Owner dashboard</p>
        </div>
        <nav className="admin-nav" aria-label="Dashboard">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <Link key={to} to={to} activeOptions={{ exact }} className="admin-nav-link">
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="/" target="_blank" rel="noreferrer" className="admin-nav-link">
            <ExternalLink size={17} aria-hidden="true" />
            View website
          </a>
          <button type="button" onClick={signOut} className="admin-nav-link">
            <LogOut size={17} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-page-head">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="admin-actions">{actions}</div>}
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
