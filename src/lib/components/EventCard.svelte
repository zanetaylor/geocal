<script lang="ts">
	import { MapPin } from '@lucide/svelte';
	import { descriptionPreview, type CalendarEventPresentation } from '$lib/calendar/presentation';

	let {
		event,
		selected,
		formattedStart,
		onToggleSelected
	}: {
		event: CalendarEventPresentation;
		selected: boolean;
		formattedStart: string;
		onToggleSelected: (id: string) => void;
	} = $props();
</script>

<article class={`p-4 transition hover:bg-neutral-800/60 ${selected ? 'bg-neutral-800' : ''}`}>
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="leading-tight font-semibold">{event.title}</h3>
			<p class="mt-1 text-sm text-neutral-300">{formattedStart}</p>
		</div>
		{#if event.coordinates}
			<button
				class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xs bg-teal-500 text-neutral-950 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] transition hover:bg-teal-400"
				type="button"
				aria-label={`Show ${event.title} on map`}
				title="Show on map"
				onclick={() => onToggleSelected(event.id)}
			>
				<MapPin class="h-4 w-4" aria-hidden="true" />
			</button>
		{:else}
			<span class="shrink-0 bg-neutral-800 px-3 py-1 text-xs text-neutral-400">Unmapped</span>
		{/if}
	</div>

	{#if event.location}
		<p class="mt-3 text-sm font-medium text-neutral-200">{event.location}</p>
	{/if}

	{#if event.description}
		<p class="mt-2 text-sm leading-6 text-neutral-400">
			{descriptionPreview(event.description)}
		</p>
	{/if}

	{#if event.url}
		<a
			class="mt-3 inline-flex text-sm font-semibold text-teal-300 hover:text-teal-200"
			href={event.url}
			target="_blank"
			rel="noreferrer"
		>
			Details
		</a>
	{/if}
</article>
