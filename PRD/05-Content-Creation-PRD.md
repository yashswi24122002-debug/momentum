# Content Creation Tool — PRD

## 1. Purpose
Same approve/reject/report pattern as the Ideas Tool, applied to Instagram travel content (Reels/carousels). Scrapes travel-content trend signals, cross-references your travel photo library, and surfaces 3 buildable content ideas per day. No video rendering — the deliverable is a concept + caption + asset list ready for you to shoot/edit and post manually.

## 2. User Flow

1. User opens **Content** tab, clicks **"Generate Today's Ideas"** (manual trigger)
2. System fetches trend signals: Google Trends (travel terms), Reddit (r/travel, r/solotravel, r/digitalnomad, r/travelphotography), YouTube Data API (trending travel Shorts), Pinterest Trends (public trends page)
3. System also pulls a summary of the user's tagged Media Library (trips, locations, content-worthy photos)
4. Signals + media summary sent to Gemini → 3 ideas, each either matched to existing photos or flagged as needing new content
5. Ideas shown as cards: concept/format (reel/carousel), trend signal, matched photo count
6. Approve ✅ / Reject ❌ per idea (same reason-logging pattern as Ideas Tool)
7. On Approve → report generated → idea enters lifecycle: `backlog → shooting_editing → ready → posted`

## 3. Media Library (supporting feature)

- Upload photos to Supabase Storage
- Auto-extract EXIF on upload (`exifr` library): GPS coordinates, date taken
- Reverse-geocode GPS → location name (OpenStreetMap Nominatim, free/rate-limited)
- Manual tagging: trip, theme, `content_worthy` flag, rating
- Grouped by `trips` for easy browsing

## 4. Data Sources

| Source | What it provides | Access |
|---|---|---|
| Google Trends | Rising search interest in destinations/formats | `pytrends` (unofficial, free) — requires a small Python helper service or subprocess call, since it's Python-only |
| Reddit API | Active travel discussion topics | Public JSON feeds — no key, same approach as Ideas Tool |
| YouTube Data API | Trending travel Shorts/videos | `YOUTUBE_API_KEY`, free quota |
| Pinterest Trends | Published seasonal/rising travel trends | Public page, no official API — treat as a periodically-checked reference, not a real-time API call |

## 5. AI Prompt Contract

**Input:** trend signals + media library summary (trip names, locations, content_worthy photo count per trip)
**Output (strict JSON):**
```json
[
  {
    "title": "string",
    "format": "reel | carousel",
    "trend_source": "string",
    "trend_signal": "string (what specifically triggered this)",
    "matched_trip_ids": ["uuid"],
    "assets_gap": "string (what's missing, if anything)"
  }
]
```

**Report prompt** (on approval), output:
```json
{
  "concept_format": "string",
  "why_trending": "string",
  "assets_available": "string",
  "assets_needed": "string",
  "caption_draft": "string",
  "hashtags": ["string"],
  "best_posting_window": "string",
  "next_action": "string"
}
```

## 6. Data Model

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  location_summary text
);

create table media (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  thumbnail_url text,
  taken_at timestamptz,
  location_lat float8,
  location_lng float8,
  location_name text,
  trip_id uuid references trips(id) on delete set null,
  tags text[],
  content_worthy boolean default false,
  rating int,
  uploaded_at timestamptz default now()
);

create table content_ideas (
  id uuid primary key default gen_random_uuid(),
  date_generated date not null,
  title text not null,
  format text check (format in ('reel','carousel')),
  trend_source text,
  trend_signal text,
  matched_media_ids uuid[] default '{}',
  status text check (status in ('pending','approved','rejected')) default 'pending',
  rejection_reason text,
  created_at timestamptz default now()
);

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  content_idea_id uuid references content_ideas(id) on delete cascade,
  concept_format text,
  why_trending text,
  assets_available text,
  assets_needed text,
  caption_draft text,
  hashtags text[],
  best_posting_window text,
  next_action text,
  lifecycle_status text check (lifecycle_status in ('backlog','shooting_editing','ready','posted')) default 'backlog',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 7. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/media` | GET/POST | List / upload media, EXIF extraction on upload |
| `/api/media/[id]` | PATCH | Tag, rate, flag content_worthy, assign trip |
| `/api/trips` | GET/POST | Manage trips |
| `/api/content/generate` | POST | Fetch trend signals + media summary, call Gemini, insert 3 pending ideas |
| `/api/content/[id]/approve` | POST | Generate report |
| `/api/content/[id]/reject` | POST | Body: `{ reason }` |
| `/api/content-reports/[id]` | PATCH | Update `lifecycle_status` |

## 8. UI Pages
- `/content` — today's pending ideas + pipeline board (grouped by lifecycle_status)
- `/content/library` — media grid, filterable by trip/tag/content_worthy, upload interface
- `/content/[id]` — full report detail for an approved idea

## 9. Acceptance Criteria
- Ideas involving existing photos correctly list matched media (verify by checking `matched_trip_ids` resolves to real photos in the library)
- If Google Trends helper service is unavailable, generation proceeds using Reddit + YouTube + Pinterest signals alone
- EXIF extraction failure (e.g., photo has no GPS data) doesn't block upload — location fields simply remain null, user can tag manually
