# Owner dashboard

The owner manages project photos, the home page photo grid, contact details and the
founder from `/admin`. Changes go live the moment they are saved; there is no redeploy.

## Signing in

- There is no "Admin" link on the site. The way in is the **©** in the footer copyright
  line ("© 2026 Elite Gutters and Aluminium Products"). Tap the © itself.
- Or go straight to `https://<domain>/admin/login`.
- Password only, no username. Tick **Keep me signed in for 30 days** on a personal phone;
  otherwise the session lasts 12 hours.
- After 8 wrong passwords from the same connection, sign-in is blocked for 15 minutes.

## What each section controls

| Section | Controls | Shows on the site |
|---|---|---|
| **Projects** | Add a photo (from the phone camera or gallery), caption, category, which service pages show it, hide/show, reorder, replace photo, delete | Projects page (in this order, newest uploads first), service page galleries, home page service cards |
| **Home grid** | Which six photos fill the "Recent projects" grid, with a crop preview per tile shape | Home page |
| **Settings** | Phone, WhatsApp number, email, Facebook link, founder's name and photo, change password | Header, footer, contact page, every WhatsApp button and the floating WhatsApp chat, "Meet the founder" |

Not editable from the dashboard (change these in code): page wording, FAQs, page titles and
SEO, menus, layout, the shipped videos' files, and banner photos outside the project list.

Notes:
- Videos already on the site can be renamed, recategorised, moved or hidden, but new videos
  can't be uploaded (photos only for now).
- Deleting a photo that shipped with the site only removes it from the list; the file stays
  in the build. Deleting an uploaded photo also deletes the file from storage.
- If a home grid photo is hidden or deleted, the grid fills the gap with the next visible photo.
- Use photos of real, finished jobs only. AI-generated flyer images must never be uploaded
  as project photos.

## Uploads

- Photos are resized in the browser to at most 1,800 px on the long side and converted to
  WebP before upload (a 6 MB phone photo becomes roughly 150–400 KB).
- Accepted: JPG, PNG, WebP, AVIF. Server limit: 10 MB.
- Stored in R2 under `projects/<uuid>.webp` or `founder/<uuid>.webp` and served from the
  same domain at `/media/...` with a one-year immutable cache (keys never repeat).

## Password

The password is stored only as a PBKDF2-SHA256 hash (100,000 iterations) in the D1
`settings` table, key `admin_password_hash`. It never appears in the code or in git.

**Change it:** Dashboard → Settings → Change password.

**Set or reset it** (e.g. forgotten password), from the project folder:

```sh
node scripts/hash-password.mjs "the new password"
npx wrangler d1 execute elite-gutters-zw --remote --command \
  "INSERT INTO settings (key, value) VALUES ('admin_password_hash', '<hash>') ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
```

**First sign-in without a seeded hash:** if no hash exists yet, the value of the
`ADMIN_SECRET` secret works as the password once, and is immediately stored as a hash.
Seeding a real hash with the commands above is preferred.

`ADMIN_SECRET` only signs session cookies; it is not the password. Rotating it
(`npx wrangler secret put ADMIN_SECRET`) signs everyone out.

## Security

- One shared password, no user accounts and no audit log of who changed what.
- Sessions are stateless signed cookies (`elite_admin`: HttpOnly, Secure, SameSite=Lax).
- Every dashboard read and change is checked on the server; state-changing requests must
  come from the site's own pages (Origin check), on top of TanStack Start's CSRF check.
- Admin pages send `noindex`, and `robots.txt` disallows `/admin`, `/api/` and
  `/_serverFn/` in every crawler group.
- If D1 can't be reached, the public site shows the content it shipped with
  (`src/data/site-data.ts`) and logs the error; the dashboard shows an error instead.

## Cloudflare resources

| Binding | Resource | Name |
|---|---|---|
| `DB` | D1 database | `elite-gutters-zw` |
| `MEDIA` | R2 bucket | `elite-gutters-zw-media` |
| `ADMIN_SECRET` | Secret | set with `wrangler secret put` |
| `ASSETS` | Static assets | the build's `public/` |

`wrangler.jsonc` is the single source of truth for these. `scripts/patch-wrangler.mjs`
stamps them onto the generated `.output/server/wrangler.json` after each build.

## Commands

```sh
# Local: build, apply migrations to the local D1, run with local D1 + R2
# (needs .dev.vars with ADMIN_SECRET=<long random string>; git-ignored)
bun run local

# Deploy (clean build first)
rm -rf .output && bun run deploy

# Apply new migrations to production
npx wrangler d1 migrations apply elite-gutters-zw --remote -c .output/server/wrangler.json

# Regenerate the seed migration from src/data (fresh databases only)
bun scripts/gen-seed.ts
```

### First-time production setup

1. `npx wrangler d1 create elite-gutters-zw` and put the `database_id` in `wrangler.jsonc`.
2. `npx wrangler r2 bucket create elite-gutters-zw-media`
3. `npx wrangler secret put ADMIN_SECRET --name elite-gutters-zw` (a long random string)
4. `rm -rf .output && bun run build && node scripts/patch-wrangler.mjs`
5. `npx wrangler d1 migrations apply elite-gutters-zw --remote -c .output/server/wrangler.json`
6. Seed the password hash (see **Password** above).
7. `npx wrangler deploy -c .output/server/wrangler.json`
