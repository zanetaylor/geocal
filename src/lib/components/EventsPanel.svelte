<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import EventCard from '$lib/components/EventCard.svelte';
	import type { CalendarEventPresentation } from '$lib/calendar/presentation';

	let {
		events,
		warnings,
		feedError,
		selectedId,
		isCollapsed,
		eventSummary,
		formatDate,
		onToggleCollapsed,
		onToggleSelected
	}: {
		events: CalendarEventPresentation[];
		warnings: string[];
		feedError?: boolean | string | null;
		selectedId: string | null;
		isCollapsed: boolean;
		eventSummary: string;
		formatDate: (value: string) => string;
		onToggleCollapsed: () => void;
		onToggleSelected: (id: string) => void;
	} = $props();
</script>

<aside
	class={`absolute top-2 right-14 left-2 z-10 flex flex-col overflow-hidden rounded-xs bg-neutral-950/85 backdrop-blur transition-[max-height,transform] sm:top-4 sm:right-16 sm:left-4 lg:right-auto lg:w-105 ${
		isCollapsed ? 'max-h-24' : 'max-h-[45%] sm:max-h-[48%] lg:max-h-[calc(100%-2rem)]'
	}`}
>
	<div class="flex items-start justify-between gap-3 p-3 sm:p-4">
		<div>
			<h2 class="text-lg font-semibold sm:text-xl">Events</h2>
			<p class="mt-1 text-sm text-neutral-400">{eventSummary}</p>
		</div>
		<button
			class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xs bg-neutral-800 text-teal-300 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] transition hover:bg-neutral-700 hover:text-teal-200 focus:ring-4 focus:ring-teal-300/40 focus:outline-none"
			type="button"
			onclick={onToggleCollapsed}
			aria-expanded={!isCollapsed}
			aria-controls="events-overlay-content"
			aria-label={isCollapsed ? 'Expand events list' : 'Collapse events list'}
			title={isCollapsed ? 'Expand events' : 'Collapse events'}
		>
			{#if isCollapsed}
				<ChevronDown class="h-4 w-4" aria-hidden="true" />
			{:else}
				<ChevronUp class="h-4 w-4" aria-hidden="true" />
			{/if}
		</button>
	</div>

	<div id="events-overlay-content" class="flex min-h-0 flex-1 flex-col">
		{#if !isCollapsed && warnings.length}
			<div class="space-y-2 p-4">
				{#each warnings as warning}
					<p class="bg-neutral-800 px-3 py-2 text-sm text-neutral-200">{warning}</p>
				{/each}
			</div>
		{/if}

		{#if isCollapsed}
			<div class="sr-only">Events list collapsed.</div>
		{:else if feedError}
			<div class="p-6 text-neutral-300">The calendar could not be loaded.</div>
		{:else if events.length === 0}
			<div class="bg-red-800 p-3 text-sm text-neutral-300">
				Load feed URL or upload a file to map events.
			</div>
		{:else}
			<div class="flex-1 divide-y divide-neutral-800 overflow-auto">
				{#each events as event (event.id)}
					<EventCard
						{event}
						selected={selectedId === event.id}
						formattedStart={formatDate(event.start)}
						{onToggleSelected}
					/>
				{/each}
			</div>
		{/if}
	</div>
</aside>
