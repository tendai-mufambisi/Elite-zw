-- Reverses 0004: the Projects page now shows videos only (filtered in
-- src/routes/projects.tsx), so the videos must be visible again.
UPDATE projects SET hidden = 0 WHERE kind = 'video';
