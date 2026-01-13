Below is a **drop-in production checklist** with concrete templates you can apply immediately to Coco’s Story. It covers **Cloud Scheduler**, **Firestore indexes**, and **cursor-safe pagination**, plus **Terraform** so you can lock this in before prod traffic.

---

## 1) Cloud Scheduler — deterministic local-time execution

**Goal:** Jobs fire at the intended local hour (DST-safe) and are idempotent.

### Recommended settings

* **Time zone:** Use an IANA zone (e.g., `America/New_York`)
* **Cron:** Expressed in local time
* **Auth:** OIDC to Cloud Run / Functions
* **Retries:** Enabled with backoff
* **Idempotency:** Job handler checks a request id or date window

### Terraform (HTTP → Cloud Run)

```hcl
resource "google_cloud_scheduler_job" "weekly_digest" {
  name      = "weekly-digest"
  schedule  = "0 9 * * MON"
  time_zone = "America/New_York"

  http_target {
    uri         = google_cloud_run_service.api.status[0].url
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }

    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      job = "weekly-digest"
    }))
  }

  retry_config {
    retry_count = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_retry_duration   = "3600s"
  }
}
```

**Handler tip:** Reject duplicates by `(job, yyyy-ww)` or a UUID in headers.

---

## 2) Firestore — composite indexes you will need

**Rule of thumb:** Any query with **multiple `where`** or **`where` + `orderBy`** needs a composite index.

### Common Coco’s Story patterns

| Collection | Query shape                                                   |
| ---------- | ------------------------------------------------------------- |
| `stories`  | `tenantId ==` + `createdAt desc`                              |
| `stories`  | `tenantId ==` + `personIds array-contains` + `createdAt desc` |
| `events`   | `tenantId ==` + `personId ==` + `startDate asc`               |
| `people`   | `tenantId ==` + `lastName asc`                                |

### `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "stories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "stories",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "personIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy with:

```bash
firebase deploy --only firestore:indexes
```

---

## 3) Pagination — cursor-safe, deterministic

**Hard rules**

* Always `orderBy` a **single, indexed field** (or a fixed tuple)
* Keep the **same ordering across pages**
* Page with **document snapshots**, not values
* Never mix `offset()` with cursors

### Web SDK (TypeScript)

```ts
import { query, where, orderBy, limit, startAfter, getDocs } from "firebase/firestore";

export async function fetchStoriesPage(
  tenantId: string,
  pageSize: number,
  cursor?: FirebaseFirestore.QueryDocumentSnapshot
) {
  const base = query(
    storiesRef,
    where("tenantId", "==", tenantId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  const q = cursor ? query(base, startAfter(cursor)) : base;
  const snap = await getDocs(q);

  return {
    items: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.at(-1)
  };
}
```

### Ties & stability

If `createdAt` collisions are possible, use a **tuple order**:

```
orderBy("createdAt","desc"), orderBy("__name__","desc")
```

…and index accordingly.

---

## 4) Security rules — performance-aware constraints

* Mirror query filters in rules (e.g., `tenantId`)
* Avoid rules that force unindexed scans
* Validate cursor paging doesn’t expose cross-tenant data

```rules
match /stories/{id} {
  allow read: if request.auth != null
    && resource.data.tenantId == request.auth.token.tenantId;
}
```

---

## 5) Pre-prod verification checklist

* [ ] Scheduler fires at correct local time across DST
* [ ] Handler is idempotent
* [ ] All prod queries have indexes deployed
* [ ] Pagination stable under concurrent writes
* [ ] Rules align with query filters
* [ ] Load test page-through (20–50 pages)

---

## Optional next steps (I can do these immediately)

* Convert your **existing cron jobs** to Terraform with correct `time_zone`
* Generate a **complete index file** from your actual query code
* Add **integration tests** that page until exhaustion
* Review **rules + indexes** together to prevent perf regressions

If you want this fully tailored, paste **one or two representative queries** (backend or web), and I’ll return the exact index definitions and tests you need.
