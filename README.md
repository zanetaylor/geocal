# geocal

`geocal` turns iCalendar events into an interactive map. Enter a public `.ics` feed URL or upload an `.ics` file, choose a date range, and the app lists the matching events while plotting geocoded locations on a MapLibre map.

## Features

- Load events from a public iCalendar feed URL or uploaded `.ics` file.
- Filter events by start/end date, with a maximum 31-day range.
- Exclude cancelled events and sort the remaining events chronologically.
- Extract coordinates from event locations when present.
- Geocode plain-text locations with MapTiler.
- Cache remote calendar feeds and geocoding results in Cloudflare KV when available, with in-memory cache fallback during local development.
- Show mapped and unmapped events in a collapsible map overlay.
- Copy a share URL for feed-backed views, including date range, time zone, and fullscreen state.
- Open the map in a fullscreen-style view via UI or `?fullscreen=true`.

## Tech Stack

- SvelteKit 2 and Svelte 5
- Tailwind CSS 4
- MapLibre via `svelte-maplibre-gl`
- MapTiler geocoding via `@maptiler/client`
- iCalendar parsing via `cal-parser`
- Cloudflare adapter and Wrangler for deployment

## Configuration

Create a local `.env` file from `.env.example` and set:

```bash
MAPTILER_API_KEY=your-maptiler-api-key
```

Without `MAPTILER_API_KEY`, the app still parses and lists events, but only locations that already contain coordinates can be mapped.

For Cloudflare deployments, `wrangler.jsonc` expects a KV namespace binding named `GEOCAL_CACHE`. That cache stores fetched calendar feeds and geocoding results. If the binding is missing, the app falls back to process-local memory cache.

## Development

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Run the Svelte/TypeScript checks:

```bash
pnpm check
```

Check formatting:

```bash
pnpm lint
```

Format the repository:

```bash
pnpm format
```

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Deployment

The project uses `@sveltejs/adapter-cloudflare`. Build output is configured for Cloudflare in `svelte.config.js` and `wrangler.jsonc`.

Deploy with Wrangler after configuring the `MAPTILER_API_KEY` secret and the `GEOCAL_CACHE` KV namespace for your Cloudflare account.

## Repository Layout

- `src/routes/+page.svelte`: main UI, form controls, map, markers, event overlay, share link handling.
- `src/routes/+page.server.ts`: feed loading, upload handling, parsing, filtering, geocoding, and caching.
- `src/app.css`: global styles and Tailwind setup.
- `svelte.config.js`: SvelteKit Cloudflare adapter configuration.
- `vite.config.ts`: Vite, SvelteKit, and Tailwind plugin configuration.
- `wrangler.jsonc`: Cloudflare Worker, assets, and KV binding configuration.
- `paseo.json`: local workspace/service helper configuration.
