import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import EventsPanel from './EventsPanel.svelte';
import type { CalendarEventPresentation } from '$lib/calendar/presentation';

const events: CalendarEventPresentation[] = [
	{
		id: 'mapped',
		title: 'Mapped event',
		start: '2026-06-30T20:00:00.000Z',
		location: 'Pioneer Courthouse Square',
		description: 'Outdoor music and food carts.',
		url: 'https://example.com/event',
		coordinates: { lng: -122.6784, lat: 45.5189 }
	},
	{
		id: 'unmapped',
		title: 'Unmapped event',
		start: '2026-06-30T22:00:00.000Z',
		location: 'Somewhere',
		description: '',
		url: '',
		coordinates: null
	}
];

describe('EventsPanel', () => {
	it('renders event list, warnings, and map affordances', () => {
		const { body } = render(EventsPanel, {
			props: {
				events,
				warnings: ['One event could not be geocoded.'],
				feedError: null,
				selectedId: 'mapped',
				isCollapsed: false,
				eventSummary: '1 mapped / 2 events from 6/1/26 to 6/30/26 - 1 not mapped',
				formatDate: () => '6/30/26, 1:00 PM',
				onToggleCollapsed: () => {},
				onToggleSelected: () => {}
			}
		});

		expect(body).toContain('Events');
		expect(body).toContain('One event could not be geocoded.');
		expect(body).toContain('Mapped event');
		expect(body).toContain('Pioneer Courthouse Square');
		expect(body).toContain('Show Mapped event on map');
		expect(body).toContain('Unmapped');
		expect(body).toContain('Details');
	});

	it('renders collapsed state without listing events', () => {
		const { body } = render(EventsPanel, {
			props: {
				events,
				warnings: [],
				feedError: null,
				selectedId: null,
				isCollapsed: true,
				eventSummary: '1 mapped / 2 events',
				formatDate: () => '6/30/26, 1:00 PM',
				onToggleCollapsed: () => {},
				onToggleSelected: () => {}
			}
		});

		expect(body).toContain('Events list collapsed.');
		expect(body).not.toContain('Mapped event');
	});
});
