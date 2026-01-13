Delta Caching for Instant‑Feeling RAG Answers
Here’s a simple idea to make repeat questions feel instant: cache a tiny “answer skeleton” and then patch in fresh facts on the fly.

What this means (plain English)

When two prompts are almost the same (same subject + time window), you serve a prebuilt outline right away (titles, key bullets, placeholders).

In the same breath, you fetch/compute the latest details and fill the placeholders as they arrive.

Net effect: the user sees something useful immediately, then it seamlessly “locks in” with up‑to‑date specifics.

Why it helps

Perceived speed boost without lying about freshness.

Works great for dashboards, summaries, or repeat research queries.

Easy to invalidate when inputs truly change.

How to detect “near‑duplicate” prompts

Build a stable cache key from:

Subject ID(s) (e.g., personID=“robert‑pierce”)

Time range (e.g., 1920‑1930)

View type (e.g., “timeline-summary”)

Normalize user text → map to those stable inputs (entity resolver + date parser).

Hash the tuple: (subject_ids, start_date, end_date, view_type, locale).

What the cached “skeleton” contains

Headline + section headers

Empty slots like: {TopEvents}, {ResidenceMoves}, {CitationsPending}

Optional canned disclaimers: “Filling in recent records…”

Minimal flow (fits your stack)

Lookup: on request, compute cache key → check Redis/Firestore.

If hit: return skeleton immediately with placeholders visible.

Parallel fetch: kick off resolvers (Firestore, Ancestry/GEDCOM, embeddings).

Patch: stream updates to replace placeholders.

Write‑back: store refreshed skeleton (and optionally results) with TTL + ETag of sources.

Example (TypeScript‑ish pseudocode)
type Key = {
  subjectIds: string[];
  range: { start: string; end: string };
  view: 'timeline-summary'|'service-record'|'relationships';
  locale: string;
};

function keyHash(k: Key) {
  return sha256(JSON.stringify(k));
}

async function handleQuery(q: UserQuery) {
  const k: Key = resolveStableInputs(q);
  const id = keyHash(k);

  const cached = await cache.get<Skeleton>(id);
  if (cached) stream(cached.render()); // fast skeleton

  // Always compute fresh in background of same request:
  const fresh = await assembleAnswer(k); // hits DBs/APIs
  stream(patchPlaceholders(fresh));      // fill slots
  await cache.set(id, toSkeleton(fresh), { ttl: 7*24*3600 });
}

Invalidation rules (keep it honest)

Time‑based TTL (e.g., 7 days).

Source version tag (e.g., GEDCOM import ETag, “people_v5”).

Param drift: if user narrows range or adds filters, new key ≠ old key.

UI microcopy (so users get it)

“Loading recent records…” under sections being filled.

Soft shimmer on placeholders; remove shimmer when patched.

Small “Updated: Jan 9, 2026” chip once details land.

Where this fits in Coco’s Story

Person Timeline: instant outline of decades with placeholders for events; patch in dates, places, citations.

Military Service card: show ranks/branches headers first; fill campaigns and documents as they resolve.

Printed book preview: render chapter structure instantly; backfill quotes/photos as assets are fetched.

If you want, I can sketch a tiny Redis + FastAPI (or Node) snippet with the cache key builder and a placeholder‑patching helper tailored to your Person/Event schema.
