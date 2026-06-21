<script lang="ts">
	import type { PageProps } from './$types';
	import { MapLibre, Marker, NavigationControl, Popup, ScaleControl } from 'svelte-maplibre-gl';

	let { data }: PageProps = $props();
	let selectedId = $state<string | null>(null);

	let mappedEvents = $derived(data.events.filter((event) => event.coordinates));
	let unmappedCount = $derived(data.events.length - mappedEvents.length);
	let defaultEndDate = $derived(getDateInputAfter(data.startDate, 7));
	let nextWeekHref = $derived(`/?start=${data.startDate}&end=${defaultEndDate}`);

	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	function formatDate(value: string) {
		return dateFormatter.format(new Date(value));
	}

	function descriptionPreview(value: string) {
		return value.length > 220 ? `${value.slice(0, 220).trim()}...` : value;
	}

	function getDateInputAfter(value: string, days: number) {
		const date = new Date(`${value}T00:00:00`);
		date.setDate(date.getDate() + days);

		return date.toISOString().slice(0, 10);
	}
</script>

<svelte:head>
	<title>CalMap</title>
	<meta
		name="description"
		content="Interactive map of public calendar events from the Shift2Bikes feed."
	/>
</svelte:head>

<main class="min-h-screen bg-slate-950 text-slate-100">
	<section class="border-b border-white/10 bg-slate-950/95 px-4 py-5 shadow-2xl shadow-black/20 sm:px-6 lg:px-8">
		<div class="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">CalMap</p>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Portland calendar events on a map</h1>
				<p class="mt-2 max-w-2xl text-sm text-slate-300">
					Live events from the Shift2Bikes public calendar, filtered by date and geocoded for quick scanning.
				</p>
			</div>

			<form method="GET" class="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
				<label class="grid gap-1 text-sm font-medium text-slate-200">
					<span>Start</span>
					<input
						class="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-cyan-300/40 transition focus:ring-4"
						type="date"
						name="start"
						value={data.startDate}
					/>
				</label>
				<label class="grid gap-1 text-sm font-medium text-slate-200">
					<span>End</span>
					<input
						class="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-cyan-300/40 transition focus:ring-4"
						type="date"
						name="end"
						value={data.endDate}
					/>
				</label>
				<button class="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-200" type="submit">
					Filter
				</button>
				<a class="rounded-xl border border-white/10 px-4 py-2 text-center font-semibold text-slate-100 transition hover:bg-white/10" href={nextWeekHref}>
					Next 7 days
				</a>
			</form>
		</div>
	</section>

	<section class="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
		<div class="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/30">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
				<div>
					<h2 class="font-semibold">Map</h2>
					<p class="text-sm text-slate-400">{mappedEvents.length} mapped / {data.events.length} total events</p>
				</div>
				{#if unmappedCount > 0}
					<p class="rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-200">{unmappedCount} not mapped</p>
				{/if}
			</div>

			<div class="h-[58vh] min-h-[360px] lg:h-[calc(100vh-210px)]">
				<MapLibre
					class="h-full"
					style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
					zoom={11}
					center={{ lng: -122.676483, lat: 45.523064 }}
				>
					<NavigationControl />
					<ScaleControl />

					{#each mappedEvents as event (event.id)}
						<Marker lnglat={event.coordinates}>
							{#snippet content()}
								<button
									class="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-slate-950/40 transition hover:scale-110"
									type="button"
									title={event.title}
									onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
								>
									•
								</button>
							{/snippet}
						</Marker>

						<Popup lnglat={event.coordinates} open={selectedId === event.id} offset={24} class="max-w-xs text-slate-950">
							<div class="space-y-2 p-1">
								<h3 class="font-semibold leading-tight">{event.title}</h3>
								<p class="text-sm text-slate-600">{formatDate(event.start)}</p>
								<p class="text-sm">{event.location}</p>
								{#if event.url}
									<a class="text-sm font-semibold text-cyan-700 underline" href={event.url} target="_blank" rel="noreferrer">Source event</a>
								{/if}
							</div>
						</Popup>
					{/each}
				</MapLibre>
			</div>
		</div>

		<aside class="rounded-3xl border border-white/10 bg-white/[0.04] lg:max-h-[calc(100vh-178px)] lg:overflow-hidden">
			<div class="border-b border-white/10 p-4">
				<h2 class="text-xl font-semibold">Events</h2>
				<p class="mt-1 text-sm text-slate-400">{data.events.length} events between {data.startDate} and {data.endDate}</p>
			</div>

			{#if data.warnings.length}
				<div class="space-y-2 border-b border-white/10 p-4">
					{#each data.warnings as warning}
						<p class="rounded-2xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{warning}</p>
					{/each}
				</div>
			{/if}

			{#if data.feedError}
				<div class="p-6 text-slate-300">The calendar feed could not be loaded. Try again later.</div>
			{:else if data.events.length === 0}
				<div class="p-6 text-slate-300">No events found for this date range.</div>
			{:else}
				<div class="divide-y divide-white/10 lg:max-h-[calc(100vh-275px)] lg:overflow-auto">
					{#each data.events as event (event.id)}
						<article class={`p-4 transition hover:bg-white/[0.03] ${selectedId === event.id ? 'bg-cyan-300/10' : ''}`}>
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="font-semibold leading-tight">{event.title}</h3>
									<p class="mt-1 text-sm text-cyan-200">{formatDate(event.start)}</p>
								</div>
								{#if event.coordinates}
									<button
										class="shrink-0 rounded-full border border-cyan-300/40 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10"
										type="button"
										onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
									>
										Map
									</button>
								{:else}
									<span class="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Unmapped</span>
								{/if}
							</div>

							{#if event.location}
								<p class="mt-3 text-sm font-medium text-slate-200">{event.location}</p>
							{/if}

							{#if event.description}
								<p class="mt-2 text-sm leading-6 text-slate-400">{descriptionPreview(event.description)}</p>
							{/if}

							{#if event.url}
								<a class="mt-3 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200" href={event.url} target="_blank" rel="noreferrer">
									Open source event
								</a>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</aside>
	</section>
</main>
