import { env } from '$env/dynamic/private';
import { config, geocoding } from '@maptiler/client';
import * as ICAL from 'cal-parser';
import type { Actions, PageServerLoad } from './$types';

const PORTLAND_CENTER: [number, number] = [-122.676483, 45.523064];
const MAX_RANGE_DAYS = 31;
const GEOCODE_BATCH_SIZE = 10;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const FEED_CACHE_FRESH_TTL_MS = 5 * 60 * 1000;
const FEED_CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const GEOCODE_FOUND_TTL_SECONDS = 30 * 24 * 60 * 60;
const GEOCODE_NOT_FOUND_TTL_SECONDS = 7 * 24 * 60 * 60;
const GEOCODE_ERROR_TTL_SECONDS = 60 * 60;

type ParsedField = { value?: unknown } | string | Date | undefined;

type ParsedEvent = {
	uid?: ParsedField;
	summary?: ParsedField;
	description?: ParsedField;
	location?: ParsedField;
	dtstart?: ParsedField;
	dtend?: ParsedField;
	status?: ParsedField;
	url?: ParsedField;
};

export type CalendarEvent = {
	id: string;
	title: string;
	description: string;
	location: string;
	start: string;
	end: string | null;
	status: string;
	url: string | null;
	coordinates: [number, number] | null;
};

type CacheNamespace = {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type CacheStore = {
	namespace?: CacheNamespace;
};

type MemoryCacheEntry = {
	value: string;
	expiresAt: number | null;
};

type CachedCalendarFeed = {
	text: string;
	name: string;
	cachedAt: number;
	freshUntil: number;
	staleUntil: number;
};

type GeocodeStatus = 'found' | 'not_found' | 'error';

type CachedGeocode = {
	coordinates: [number, number] | null;
	status: GeocodeStatus;
	cachedAt: number;
};

const memoryCache = new Map<string, MemoryCacheEntry>();

export const load: PageServerLoad = async ({ fetch, platform, url }) => {
	const cache = createCache(platform?.env?.GEOCAL_CACHE);
	const range = getDateRange(url.searchParams);
	const sourceUrl = readFeedUrlSearchParam(url.searchParams);

	if (!sourceUrl) {
		return emptyCalendarResult(range);
	}

	try {
		const calendarSource = await fetchCalendarFeed(fetch, sourceUrl, cache);

		return await processCalendarText(
			calendarSource.text,
			range,
			{
				sourceUrl,
				sourceName: calendarSource.name
			},
			cache,
			calendarSource.warning ? [calendarSource.warning] : []
		);
	} catch (error) {
		return {
			...emptyCalendarResult(range),
			sourceUrl,
			warnings: [error instanceof Error ? error.message : 'Unable to load calendar.'],
			feedError: true
		};
	}
};

export const actions: Actions = {
	default: async ({ fetch, platform, request }) => {
		const cache = createCache(platform?.env?.GEOCAL_CACHE);
		const formData = await request.formData();
		const range = getDateRange(formDataToSearchParams(formData));
		const sourceUrl = readFormString(formData.get('feedUrl'));
		const calendarFile = formData.get('calendarFile');
		const hasUpload = calendarFile instanceof File && calendarFile.size > 0;

		if (sourceUrl && hasUpload) {
			return {
				...emptyCalendarResult(range),
				sourceUrl,
				sourceName: calendarFile.name,
				warnings: ['Enter a feed URL or upload an iCal file, not both.'],
				feedError: true
			};
		}

		if (!sourceUrl && !hasUpload) {
			return {
				...emptyCalendarResult(range),
				warnings: ['Enter an iCal feed URL or upload an .ics file.'],
				feedError: true
			};
		}

		try {
			const calendarSource = hasUpload
				? await readUploadedCalendar(calendarFile)
				: await fetchCalendarFeed(fetch, sourceUrl, cache);

			return await processCalendarText(
				calendarSource.text,
				range,
				{
					sourceUrl,
					sourceName: calendarSource.name
				},
				cache,
				readCalendarSourceWarning(calendarSource)
			);
		} catch (error) {
			return {
				...emptyCalendarResult(range),
				sourceUrl,
				sourceName: hasUpload ? calendarFile.name : null,
				warnings: [error instanceof Error ? error.message : 'Unable to load calendar.'],
				feedError: true
			};
		}
	}
};

function emptyCalendarResult(range: ReturnType<typeof getDateRange>) {
	return {
		events: [],
		startDate: range.startDate,
		endDate: range.endDate,
		timeZone: range.timeZone,
		sourceUrl: '',
		sourceName: null as string | null,
		warnings: [] as string[],
		feedError: false
	};
}

function readCalendarSourceWarning(calendarSource: unknown) {
	if (
		typeof calendarSource === 'object' &&
		calendarSource &&
		'warning' in calendarSource &&
		typeof calendarSource.warning === 'string'
	) {
		return [calendarSource.warning];
	}

	return [];
}

async function fetchCalendarFeed(
	fetch: typeof globalThis.fetch,
	sourceUrl: string,
	cache: CacheStore
) {
	const url = parseFeedUrl(sourceUrl);
	const cacheKey = await buildCacheKey('feed:v1:', url.toString());
	const cachedFeed = await readCacheJson<CachedCalendarFeed>(cache, cacheKey);
	const now = Date.now();

	if (isCachedCalendarFeed(cachedFeed) && now <= cachedFeed.freshUntil) {
		return {
			text: cachedFeed.text,
			name: cachedFeed.name
		};
	}

	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'calmap/0.0.1',
				Accept: 'text/calendar,*/*'
			}
		});

		if (!response.ok) {
			throw new Error(`Calendar feed returned ${response.status}.`);
		}

		const calendarFeed = {
			text: await response.text(),
			name: url.toString()
		};

		await writeCacheJson(
			cache,
			cacheKey,
			{
				...calendarFeed,
				cachedAt: now,
				freshUntil: now + FEED_CACHE_FRESH_TTL_MS,
				staleUntil: now + FEED_CACHE_STALE_TTL_MS
			},
			Math.ceil(FEED_CACHE_STALE_TTL_MS / 1000)
		);

		return calendarFeed;
	} catch (error) {
		if (isCachedCalendarFeed(cachedFeed) && now <= cachedFeed.staleUntil) {
			console.warn('Calendar feed refresh failed; using stale cache.', error);

			return {
				text: cachedFeed.text,
				name: cachedFeed.name,
				warning: 'Using cached calendar data because the feed could not be refreshed.'
			};
		}

		throw error;
	}
}

async function readUploadedCalendar(calendarFile: File) {
	if (calendarFile.size > MAX_UPLOAD_SIZE) {
		throw new Error('Uploaded iCal file must be 5 MB or smaller.');
	}

	return {
		text: await calendarFile.text(),
		name: calendarFile.name
	};
}

async function processCalendarText(
	calendarText: string,
	range: ReturnType<typeof getDateRange>,
	source: { sourceUrl: string; sourceName: string | null },
	cache: CacheStore,
	initialWarnings: string[] = []
) {
	const warnings: string[] = [...initialWarnings];

	try {
		const parsed = ICAL.parseString(calendarText) as { events?: ParsedEvent[] };
		const events = (parsed.events ?? [])
			.map(normalizeEvent)
			.filter((event): event is CalendarEvent => Boolean(event))
			.filter((event) => event.status !== 'CANCELLED')
			.filter((event) => eventInRange(event, range))
			.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

		if (env.MAPTILER_API_KEY) {
			config.apiKey = env.MAPTILER_API_KEY;
			await geocodeEvents(events, warnings, cache);
		} else {
			warnings.push('Set MAPTILER_API_KEY to show geocoded map markers.');
		}

		return {
			events,
			startDate: range.startDate,
			endDate: range.endDate,
			timeZone: range.timeZone,
			sourceUrl: source.sourceUrl,
			sourceName: source.sourceName,
			warnings,
			feedError: false
		};
	} catch (error) {
		return {
			events: [],
			startDate: range.startDate,
			endDate: range.endDate,
			timeZone: range.timeZone,
			sourceUrl: source.sourceUrl,
			sourceName: source.sourceName,
			warnings: [error instanceof Error ? error.message : 'Unable to parse calendar.'],
			feedError: true
		};
	}
}

function normalizeEvent(event: ParsedEvent): CalendarEvent | null {
	const start = readDate(event.dtstart);

	if (!start) {
		return null;
	}

	const id = readString(event.uid) || `${readString(event.summary)}-${start.toISOString()}`;
	const title = readString(event.summary) || 'Untitled event';
	const location = readString(event.location);

	return {
		id,
		title,
		description: readString(event.description),
		location,
		start: start.toISOString(),
		end: readDate(event.dtend)?.toISOString() ?? null,
		status: (readString(event.status) || 'CONFIRMED').toUpperCase(),
		url: readString(event.url) || null,
		coordinates: extractCoordinates(location)
	};
}

async function geocodeEvents(events: CalendarEvent[], warnings: string[], cache: CacheStore) {
	const needsGeocoding = events.filter((event) => event.location && !event.coordinates);
	const geocodedLocations = new Map<string, CachedGeocode>();
	const locations = Array.from(
		new Set(
			needsGeocoding.map((event) => normalizeLocationForGeocoding(event.location)).filter(Boolean)
		)
	);
	const uncachedLocations: string[] = [];

	for (const location of locations) {
		const cachedGeocode = await readGeocodeCache(cache, location);

		if (cachedGeocode) {
			geocodedLocations.set(location, cachedGeocode);
		} else {
			uncachedLocations.push(location);
		}
	}

	if (uncachedLocations.length) {
		let failedCount = 0;

		for (let index = 0; index < uncachedLocations.length; index += GEOCODE_BATCH_SIZE) {
			const locations = uncachedLocations.slice(index, index + GEOCODE_BATCH_SIZE);
			const batchResult = await geocodeLocationBatch(locations, cache);

			failedCount += batchResult.failedCount;
			batchResult.geocodes.forEach((geocode, location) => {
				geocodedLocations.set(location, geocode);
			});
		}

		if (failedCount > 0) {
			warnings.push(
				`${failedCount} ${failedCount === 1 ? 'location' : 'locations'} could not be geocoded; events are still listed below.`
			);
		}
	}

	needsGeocoding.forEach((event) => {
		event.coordinates =
			geocodedLocations.get(normalizeLocationForGeocoding(event.location))?.coordinates ?? null;
	});
}

async function geocodeLocationBatch(locations: string[], cache: CacheStore) {
	const geocodes = new Map<string, CachedGeocode>();

	try {
		const results = await geocoding.batch(locations, {
			country: ['us'],
			proximity: PORTLAND_CENTER
		});

		await Promise.all(
			results.map(async (result, index) => {
				const location = locations[index];
				const geocode = createCachedGeocode(coordinatesFromGeocodeResult(result));

				geocodes.set(location, geocode);
				await writeGeocodeCache(cache, location, geocode);
			})
		);

		return { failedCount: 0, geocodes };
	} catch (error) {
		console.warn('MapTiler batch geocoding failed; falling back to individual lookups.', error);

		let failedCount = 0;

		for (const location of locations) {
			try {
				const result = await geocoding.forward(location, {
					country: ['us'],
					proximity: PORTLAND_CENTER
				});
				const geocode = createCachedGeocode(coordinatesFromGeocodeResult(result));

				geocodes.set(location, geocode);
				await writeGeocodeCache(cache, location, geocode);
			} catch (fallbackError) {
				failedCount += 1;
				const geocode = createCachedGeocode(null, 'error');

				geocodes.set(location, geocode);
				await writeGeocodeCache(cache, location, geocode);
				console.warn(`MapTiler geocoding failed for "${location}".`, fallbackError);
			}
		}

		return { failedCount, geocodes };
	}
}

function createCache(namespace?: CacheNamespace): CacheStore {
	return { namespace };
}

async function readCacheJson<T>(cache: CacheStore, key: string) {
	try {
		const value = cache.namespace ? await cache.namespace.get(key) : readMemoryCache(key);

		return value ? (JSON.parse(value) as T) : null;
	} catch (error) {
		console.warn(`Unable to read cache key "${key}".`, error);

		return null;
	}
}

async function writeCacheJson(
	cache: CacheStore,
	key: string,
	value: unknown,
	expirationTtl: number
) {
	try {
		const serialized = JSON.stringify(value);

		if (cache.namespace) {
			await cache.namespace.put(key, serialized, { expirationTtl });
		} else {
			writeMemoryCache(key, serialized, expirationTtl);
		}
	} catch (error) {
		console.warn(`Unable to write cache key "${key}".`, error);
	}
}

function readMemoryCache(key: string) {
	const entry = memoryCache.get(key);

	if (!entry) {
		return null;
	}

	if (entry.expiresAt && entry.expiresAt <= Date.now()) {
		memoryCache.delete(key);

		return null;
	}

	return entry.value;
}

function writeMemoryCache(key: string, value: string, expirationTtl: number) {
	memoryCache.set(key, {
		value,
		expiresAt: expirationTtl > 0 ? Date.now() + expirationTtl * 1000 : null
	});
}

async function readGeocodeCache(cache: CacheStore, location: string) {
	const cacheKey = await buildCacheKey('geo:v1:', location);
	const geocode = await readCacheJson<CachedGeocode>(cache, cacheKey);

	return isFreshCachedGeocode(geocode) ? geocode : null;
}

async function writeGeocodeCache(cache: CacheStore, location: string, geocode: CachedGeocode) {
	await writeCacheJson(
		cache,
		await buildCacheKey('geo:v1:', location),
		geocode,
		geocodeTtl(geocode)
	);
}

function createCachedGeocode(
	coordinates: [number, number] | null,
	status: GeocodeStatus = coordinates ? 'found' : 'not_found'
): CachedGeocode {
	return {
		coordinates,
		status,
		cachedAt: Date.now()
	};
}

function geocodeTtl(geocode: CachedGeocode) {
	if (geocode.status === 'found') return GEOCODE_FOUND_TTL_SECONDS;
	if (geocode.status === 'not_found') return GEOCODE_NOT_FOUND_TTL_SECONDS;

	return GEOCODE_ERROR_TTL_SECONDS;
}

function isFreshCachedGeocode(value: CachedGeocode | null): value is CachedGeocode {
	if (!value || !isCoordinatesOrNull(value.coordinates)) {
		return false;
	}

	return value.cachedAt + geocodeTtl(value) * 1000 > Date.now();
}

function isCachedCalendarFeed(value: CachedCalendarFeed | null): value is CachedCalendarFeed {
	return Boolean(
		value &&
		typeof value.text === 'string' &&
		typeof value.name === 'string' &&
		typeof value.cachedAt === 'number' &&
		typeof value.freshUntil === 'number' &&
		typeof value.staleUntil === 'number'
	);
}

function isCoordinatesOrNull(value: unknown): value is [number, number] | null {
	return (
		value === null ||
		(Array.isArray(value) &&
			value.length === 2 &&
			typeof value[0] === 'number' &&
			typeof value[1] === 'number')
	);
}

async function buildCacheKey(prefix: string, value: string) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');

	return `${prefix}${hash}`;
}

function coordinatesFromGeocodeResult(result: Awaited<ReturnType<typeof geocoding.forward>>) {
	const feature = result.features?.find((item) => item.geometry?.type === 'Point');
	const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;

	return Array.isArray(coordinates) && coordinates.length >= 2
		? ([coordinates[0], coordinates[1]] as [number, number])
		: null;
}

function getDateRange(searchParams: URLSearchParams) {
	const timeZone = readTimeZone(searchParams) ?? 'UTC';
	const today = toDateInputValue(new Date(), timeZone);
	const defaultEnd = addDays(today, 7);
	const requestedStart = searchParams.get('start');
	const requestedEnd = searchParams.get('end');
	let startDate = isDateInputValue(requestedStart) ? requestedStart : today;
	let endDate = isDateInputValue(requestedEnd) ? requestedEnd : defaultEnd;

	if (endDate < startDate) {
		endDate = startDate;
	}

	if (daysBetween(startDate, endDate) > MAX_RANGE_DAYS) {
		endDate = addDays(startDate, MAX_RANGE_DAYS);
	}

	return {
		startDate,
		endDate,
		timeZone
	};
}

function formDataToSearchParams(formData: FormData) {
	const searchParams = new URLSearchParams();
	const start = readFormString(formData.get('start'));
	const end = readFormString(formData.get('end'));
	const timeZone = readFormString(formData.get('timeZone'));

	if (start) searchParams.set('start', start);
	if (end) searchParams.set('end', end);
	if (timeZone) searchParams.set('timeZone', timeZone);

	return searchParams;
}

function parseFeedUrl(value: string) {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error('Enter a valid iCal feed URL.');
	}

	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new Error('iCal feed URL must start with http:// or https://.');
	}

	return url;
}

function readFormString(value: FormDataEntryValue | null) {
	return typeof value === 'string' ? value.trim() : '';
}

function readFeedUrlSearchParam(searchParams: URLSearchParams) {
	for (const name of ['feedUrl', 'icalUrl', 'url']) {
		const value = searchParams.get(name)?.trim();

		if (value) {
			return value;
		}
	}

	return '';
}

function isDateInputValue(value: string | null): value is string {
	return Boolean(value?.match(/^\d{4}-\d{2}-\d{2}$/));
}

function eventInRange(event: CalendarEvent, range: ReturnType<typeof getDateRange>) {
	const eventStartDate = toDateInputValue(new Date(event.start), range.timeZone);

	return eventStartDate >= range.startDate && eventStartDate <= range.endDate;
}

function readString(field: ParsedField) {
	const value = typeof field === 'object' && field && 'value' in field ? field.value : field;

	return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function readDate(field: ParsedField) {
	const value = typeof field === 'object' && field && 'value' in field ? field.value : field;
	const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;

	return date && !Number.isNaN(date.getTime()) ? date : null;
}

function normalizeLocationForGeocoding(location: string) {
	const normalized = location.trim().replace(/\s+/g, ' ');

	if (!normalized) {
		return '';
	}

	return /\b(portland|beaverton|tigard|vancouver|gresham|hillsboro|oregon|washington|\bOR\b|\bWA\b)\b/i.test(
		normalized
	)
		? normalized
		: `${normalized}, Portland, OR`;
}

function extractCoordinates(location: string): [number, number] | null {
	const match = location.match(
		/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[^\d-]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i
	);

	if (!match) {
		return null;
	}

	let lat = Number(match[1]);
	let lng = Number(match[3]);

	if (match[2]?.toUpperCase() === 'S') lat *= -1;
	if (match[4]?.toUpperCase() === 'W') lng *= -1;

	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
		return null;
	}

	return [lng, lat];
}

function readTimeZone(searchParams: URLSearchParams) {
	const timeZone = searchParams.get('timeZone') || searchParams.get('tz');

	if (!timeZone) {
		return null;
	}

	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return null;
	}
}

function toDateInputValue(date: Date, timeZone = 'UTC') {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const year = parts.find((part) => part.type === 'year')?.value;
	const month = parts.find((part) => part.type === 'month')?.value;
	const day = parts.find((part) => part.type === 'day')?.value;

	return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
}

function addDays(dateInputValue: string, days: number) {
	const date = new Date(`${dateInputValue}T00:00:00`);
	date.setDate(date.getDate() + days);

	return toDateInputValue(date);
}

function daysBetween(startDate: string, endDate: string) {
	const start = new Date(`${startDate}T00:00:00`).getTime();
	const end = new Date(`${endDate}T00:00:00`).getTime();

	return Math.round((end - start) / 86_400_000);
}
