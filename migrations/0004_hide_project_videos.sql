-- The Projects page shows photos only. Videos stay in the dashboard as hidden items,
-- so the owner can show one again if wanted.
UPDATE projects SET hidden = 1 WHERE kind = 'video';
