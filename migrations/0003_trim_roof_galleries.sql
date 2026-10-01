-- Match the SA site: the waterproofing gallery keeps its two process photos and the
-- painting gallery keeps one photo. These photos stay on the Projects page; they just
-- stop appearing in those two service galleries.
UPDATE projects SET services = '' WHERE slot IN (
  'waterproofing-flat-roof-finished',
  'waterproofing-roof-edges',
  'roof-painting-ridge',
  'roof-painting-metal-roof-house'
);
