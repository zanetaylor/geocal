import { env } from '$env/dynamic/private';
import { config, geocoding } from '@maptiler/client';
import * as ICAL from 'cal-parser';
import type { Actions, PageServerLoad } from './$types';

const PORTLAND_CENTER: [number, number] = [-122.676483, 45.523064];
const MAX_RANGE_DAYS = 31;
const GEOCODE_BATCH_SIZE = 10;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

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

const geocodeCache = new Map<string, [number, number] | null>();

export const load: PageServerLoad = async ({ fetch, url }) => {
	const range = getDateRange(url.searchParams);
	const sourceUrl = readFeedUrlSearchParam(url.searchParams);

	if (!sourceUrl) {
		return emptyCalendarResult(range);
	}

	try {
		const calendarSource = await fetchCalendarFeed(fetch, sourceUrl);

		return await processCalendarText(calendarSource.text, range, {
			sourceUrl,
			sourceName: calendarSource.name
		});
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
	default: async ({ fetch, request }) => {
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
				: await fetchCalendarFeed(fetch, sourceUrl);

			return await processCalendarText(calendarSource.text, range, {
				sourceUrl,
				sourceName: calendarSource.name
			});
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
		sourceUrl: '',
		sourceName: null as string | null,
		warnings: [] as string[],
		feedError: false
	};
}

async function fetchCalendarFeed(fetch: typeof globalThis.fetch, sourceUrl: string) {
	const url = parseFeedUrl(sourceUrl);
	const response = await fetch(url, {
		headers: {
			'User-Agent': 'calmap/0.0.1',
			Accept: 'text/calendar,*/*'
		}
	});

	if (!response.ok) {
		throw new Error(`Calendar feed returned ${response.status}.`);
	}

	return {
		text: await response.text(),
		name: url.toString()
	};
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
	source: { sourceUrl: string; sourceName: string | null }
) {
	const warnings: string[] = [];

	try {
		const parsed = ICAL.parseString(calendarText) as { events?: ParsedEvent[] };
		const events = (parsed.events ?? [])
			.map(normalizeEvent)
			.filter((event): event is CalendarEvent => Boolean(event))
			.filter((event) => event.status !== 'CANCELLED')
			.filter((event) => eventInRange(event, range.start, range.end))
			.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

		if (env.MAPTILER_API_KEY) {
			config.apiKey = env.MAPTILER_API_KEY;
			await geocodeEvents(events, warnings);
		} else {
			warnings.push('Set MAPTILER_API_KEY to show geocoded map markers.');
		}

		return {
			events,
			startDate: range.startDate,
			endDate: range.endDate,
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

async function geocodeEvents(events: CalendarEvent[], warnings: string[]) {
	const needsGeocoding = events.filter((event) => event.location && !event.coordinates);
	const uncachedLocations = Array.from(
		new Set(
			needsGeocoding
				.map((event) => normalizeLocationForGeocoding(event.location))
				.filter((location) => location && !geocodeCache.has(location))
		)
	);

	if (uncachedLocations.length) {
		let failedCount = 0;

		for (let index = 0; index < uncachedLocations.length; index += GEOCODE_BATCH_SIZE) {
			const locations = uncachedLocations.slice(index, index + GEOCODE_BATCH_SIZE);
			failedCount += await geocodeLocationBatch(locations);
		}

		if (failedCount > 0) {
			warnings.push(
				`${failedCount} ${failedCount === 1 ? 'location' : 'locations'} could not be geocoded; events are still listed below.`
			);
		}
	}

	needsGeocoding.forEach((event) => {
		event.coordinates = geocodeCache.get(normalizeLocationForGeocoding(event.location)) ?? null;
	});
}

async function geocodeLocationBatch(locations: string[]) {
	try {
		const results = await geocoding.batch(locations, {
			country: ['us'],
			proximity: PORTLAND_CENTER
		});

		results.forEach((result, index) => {
			geocodeCache.set(locations[index], coordinatesFromGeocodeResult(result));
		});

		return 0;
	} catch (error) {
		console.warn('MapTiler batch geocoding failed; falling back to individual lookups.', error);

		let failedCount = 0;

		for (const location of locations) {
			try {
				const result = await geocoding.forward(location, {
					country: ['us'],
					proximity: PORTLAND_CENTER
				});

				geocodeCache.set(location, coordinatesFromGeocodeResult(result));
			} catch (fallbackError) {
				failedCount += 1;
				geocodeCache.set(location, null);
				console.warn(`MapTiler geocoding failed for "${location}".`, fallbackError);
			}
		}

		return failedCount;
	}
}

function coordinatesFromGeocodeResult(result: Awaited<ReturnType<typeof geocoding.forward>>) {
	const feature = result.features?.find((item) => item.geometry?.type === 'Point');
	const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;

	return Array.isArray(coordinates) && coordinates.length >= 2
		? ([coordinates[0], coordinates[1]] as [number, number])
		: null;
}

function getDateRange(searchParams: URLSearchParams) {
	const today = toDateInputValue(new Date());
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
		start: new Date(`${startDate}T00:00:00`),
		end: new Date(`${endDate}T23:59:59.999`)
	};
}

function formDataToSearchParams(formData: FormData) {
	const searchParams = new URLSearchParams();
	const start = readFormString(formData.get('start'));
	const end = readFormString(formData.get('end'));

	if (start) searchParams.set('start', start);
	if (end) searchParams.set('end', end);

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

function eventInRange(event: CalendarEvent, start: Date, end: Date) {
	const eventStart = new Date(event.start);

	return eventStart >= start && eventStart <= end;
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

function isDateInputValue(value: string | null): value is string {
	return Boolean(value?.match(/^\d{4}-\d{2}-\d{2}$/));
}

function toDateInputValue(date: Date) {
	return date.toISOString().slice(0, 10);
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
