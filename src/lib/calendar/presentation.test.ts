import { describe, expect, it } from 'vitest';
import {
	buildShareUrl,
	createDateTimeFormatter,
	descriptionPreview,
	formatDate,
	formatDateOnly,
	readFullscreenSearchParam,
	setFullscreenSearchParam
} from './presentation';

describe('calendar presentation helpers', () => {
	it('formats date-only values with the existing short numeric format', () => {
		expect(formatDateOnly('2026-06-30')).toBe('6/30/26');
	});

	it('formats event date-times with the provided time zone', () => {
		const formatter = createDateTimeFormatter('America/Los_Angeles');

		expect(formatDate('2026-06-30T20:05:00.000Z', formatter)).toBe('6/30/26, 1:05 PM');
	});

	it('truncates long descriptions at the preview length', () => {
		const description = `${'a'.repeat(219)} trailing words`;

		expect(descriptionPreview(description)).toBe(`${'a'.repeat(219)}...`);
	});

	it('builds share URLs from the current page while replacing existing query params', () => {
		expect(
			buildShareUrl({
				currentHref: 'https://example.com/map?old=true#events',
				sourceUrl: 'https://calendar.example/feed.ics',
				startDate: '2026-06-01',
				endDate: '2026-06-30',
				timeZone: 'America/Los_Angeles',
				isFullscreen: true
			})
		).toBe(
			'https://example.com/map?feedUrl=https%3A%2F%2Fcalendar.example%2Ffeed.ics&start=2026-06-01&end=2026-06-30&timeZone=America%2FLos_Angeles&fullscreen=true#events'
		);
	});

	it('reads supported fullscreen query param values', () => {
		expect(readFullscreenSearchParam(new URLSearchParams('fullscreen=true'))).toBe(true);
		expect(readFullscreenSearchParam(new URLSearchParams('fullscreen=1'))).toBe(true);
		expect(readFullscreenSearchParam(new URLSearchParams('fullscreen=false'))).toBe(false);
	});

	it('writes fullscreen query params without dropping other URL state', () => {
		expect(setFullscreenSearchParam('https://example.com/map?feedUrl=x', true)).toBe(
			'https://example.com/map?feedUrl=x&fullscreen=true'
		);
		expect(
			setFullscreenSearchParam('https://example.com/map?feedUrl=x&fullscreen=true', false)
		).toBe('https://example.com/map?feedUrl=x');
	});
});
