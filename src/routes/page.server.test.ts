import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent, CachedGeocode } from './+page.server';
import { eventInRange, geocodeTtl, isFreshCachedGeocode } from './+page.server';

function cachedGeocode(value: Partial<CachedGeocode> = {}): CachedGeocode {
	return {
		coordinates: [-122.676483, 45.523064],
		status: 'found',
		cachedAt: Date.now(),
		...value
	};
}

function calendarEvent(start: string): CalendarEvent {
	return {
		id: start,
		title: 'Test event',
		description: '',
		location: 'Portland, OR',
		start,
		end: null,
		status: '',
		url: null,
		coordinates: null
	};
}

describe('geocode cache helpers', () => {
	it('uses shorter TTLs for lower-confidence geocode statuses', () => {
		expect(geocodeTtl(cachedGeocode({ status: 'found' }))).toBe(30 * 24 * 60 * 60);
		expect(geocodeTtl(cachedGeocode({ coordinates: null, status: 'not_found' }))).toBe(
			7 * 24 * 60 * 60
		);
		expect(geocodeTtl(cachedGeocode({ coordinates: null, status: 'error' }))).toBe(60 * 60);
	});

	it('treats cached geocodes as fresh only before their TTL expires', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

		try {
			const geocode = cachedGeocode({ cachedAt: Date.now() });
			const expiresAt = geocode.cachedAt + geocodeTtl(geocode) * 1000;

			vi.setSystemTime(new Date(expiresAt - 1));
			expect(isFreshCachedGeocode(geocode)).toBe(true);

			vi.setSystemTime(new Date(expiresAt));
			expect(isFreshCachedGeocode(geocode)).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it('rejects missing cached geocodes', () => {
		expect(isFreshCachedGeocode(null)).toBe(false);
	});
});

describe('eventInRange', () => {
	it('includes events that start on the start or end date', () => {
		const range = { startDate: '2026-01-10', endDate: '2026-01-12', timeZone: 'UTC' };

		expect(eventInRange(calendarEvent('2026-01-10T00:00:00.000Z'), range)).toBe(true);
		expect(eventInRange(calendarEvent('2026-01-12T23:59:59.000Z'), range)).toBe(true);
	});

	it('excludes events outside the date range', () => {
		const range = { startDate: '2026-01-10', endDate: '2026-01-12', timeZone: 'UTC' };

		expect(eventInRange(calendarEvent('2026-01-09T23:59:59.000Z'), range)).toBe(false);
		expect(eventInRange(calendarEvent('2026-01-13T00:00:00.000Z'), range)).toBe(false);
	});

	it('applies the selected time zone before comparing date boundaries', () => {
		const range = {
			startDate: '2026-01-01',
			endDate: '2026-01-01',
			timeZone: 'America/Los_Angeles'
		};

		expect(eventInRange(calendarEvent('2026-01-02T07:30:00.000Z'), range)).toBe(true);
		expect(eventInRange(calendarEvent('2026-01-02T08:00:00.000Z'), range)).toBe(false);
	});
});
