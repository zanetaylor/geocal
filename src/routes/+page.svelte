<script lang="ts">
	import type { PageProps } from './$types';
	import { MapLibre, Marker, NavigationControl, Popup, ScaleControl } from 'svelte-maplibre-gl';

	let { data, form }: PageProps = $props();
	let selectedId = $state<string | null>(null);
	let calendar = $derived(form ?? data);

	let mappedEvents = $derived(calendar.events.filter((event) => event.coordinates));
	let unmappedCount = $derived(calendar.events.length - mappedEvents.length);
	let eventSummary = $derived(
		`${mappedEvents.length} mapped / ${calendar.events.length} total events between ${calendar.startDate} and ${calendar.endDate}${
			unmappedCount > 0 ? ` - ${unmappedCount} not mapped` : ''
		}`
	);

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
</script>

<svelte:head>
	<title>Geocal - A map of events</title>
	<meta name="description" content="Interactive map of events from an iCal feed or uploaded iCal file." />
</svelte:head>

<main class="min-h-screen bg-neutral-950 bg-[url($lib/assets/img/cartographer.png)] text-neutral-100">
	<section class="bg-[#00000060] p-5 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
		<div class="mx-auto flex flex-col gap-5">
			<div>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">geocal</h1>
				<p class="mt-2 max-w-2xl text-sm text-neutral-300">
					Enter a public iCal feed URL or upload an .ics file to see the events on the map.
				</p>
			</div>

			<form
				method="POST"
				enctype="multipart/form-data"
				class="grid w-full grid-cols-[minmax(14rem,2fr)_minmax(12rem,1.5fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto] items-end gap-3 overflow-x-auto"
			>
				<label class="grid gap-1 text-sm font-medium text-neutral-200">
					<span>Public iCal feed URL</span>
					<input
						class="h-11 min-w-0 bg-neutral-800 px-3 text-neutral-100 outline-none ring-blue-300/40 transition placeholder:text-neutral-500 focus:ring-4"
						type="url"
						name="feedUrl"
						value={calendar.sourceUrl}
						placeholder="https://example.com/calendar.ics"
					/>
				</label>
				<label class="grid gap-1 text-sm font-medium text-neutral-200">
					<span>iCal file</span>
					<input
						class="h-11 min-w-0 bg-neutral-800 px-3 text-sm text-neutral-100 outline-none file:mr-3 file:h-8 file:border-0 file:bg-blue-500 file:px-3 file:font-semibold file:text-white file:hover:bg-blue-400"
						type="file"
						name="calendarFile"
						accept=".ics,text/calendar"
					/>
				</label>
				<label class="grid gap-1 text-sm font-medium text-neutral-200">
					<span>Start</span>
					<input
						class="h-11 bg-neutral-800 px-3 text-neutral-100 outline-none ring-blue-300/40 transition focus:ring-4"
						type="date"
						name="start"
						value={calendar.startDate}
					/>
				</label>
				<label class="grid gap-1 text-sm font-medium text-neutral-200">
					<span>End</span>
					<input
						class="h-11 bg-neutral-800 px-3 text-neutral-100 outline-none ring-blue-300/40 transition focus:ring-4"
						type="date"
						name="end"
						value={calendar.endDate}
					/>
				</label>
				<button class="h-11 bg-blue-500 px-4 font-semibold text-white transition hover:bg-blue-400" type="submit">
				Go!
				</button>
			</form>
		</div>
	</section>

	<section class="relative h-[calc(100vh-268px)] min-h-[620px] overflow-hidden bg-neutral-900 shadow-2xl shadow-black/30">
		<div class="absolute inset-0">
			<MapLibre
				class="h-full w-full"
				style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
				zoom={11}
				center={{ lng: -122.676483, lat: 45.523064 }}
			>
				<NavigationControl />
				<ScaleControl  />

				{#each mappedEvents as event (event.id)}
					<Marker lnglat={event.coordinates}>
						{#snippet content()}
							<button
								class="grid h-8 w-8 place-items-center bg-blue-500 text-sm font-black text-white shadow-lg shadow-neutral-950/40 transition hover:scale-110"
								type="button"
								title={event.title}
								onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
							>
								•
							</button>
						{/snippet}
					</Marker>

					<Popup lnglat={event.coordinates} open={selectedId === event.id} offset={24} class="max-w-xs text-neutral-950">
						<div class="space-y-2 p-1">
							<h3 class="font-semibold leading-tight">{event.title}</h3>
							<p class="text-sm text-neutral-600">{formatDate(event.start)}</p>
							<p class="text-sm">{event.location}</p>
							{#if event.url}
								<a class="text-sm font-semibold text-blue-700 underline" href={event.url} target="_blank" rel="noreferrer">Source event</a>
							{/if}
						</div>
					</Popup>
				{/each}
			</MapLibre>
		</div>

		<aside class="absolute inset-x-3 bottom-3 z-10 flex max-h-[48%] flex-col overflow-hidden bg-neutral-950/90 shadow-2xl shadow-black/40 backdrop-blur sm:inset-x-4 sm:bottom-4 lg:inset-x-auto lg:inset-y-8 lg:left-8 lg:w-[420px] lg:max-h-none">
			<div class="p-4">
				<h2 class="text-xl font-semibold">Events</h2>
				<p class="mt-1 text-sm text-neutral-400">{eventSummary}</p>
			</div>

			{#if calendar.warnings.length}
				<div class="space-y-2 p-4">
					{#each calendar.warnings as warning}
						<p class="bg-neutral-800 px-3 py-2 text-sm text-neutral-200">{warning}</p>
					{/each}
				</div>
			{/if}

			{#if calendar.feedError}
				<div class="p-6 text-neutral-300">The calendar could not be loaded.</div>
			{:else if calendar.events.length === 0}
				<div class="p-6 text-neutral-300">Load an iCal feed URL or upload an .ics file to map events.</div>
			{:else}
				<div class="flex-1 divide-y divide-neutral-800 overflow-auto">
					{#each calendar.events as event (event.id)}
						<article class={`p-4 transition hover:bg-neutral-800/60 ${selectedId === event.id ? 'bg-neutral-800' : ''}`}>
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="font-semibold leading-tight">{event.title}</h3>
									<p class="mt-1 text-sm text-neutral-300">{formatDate(event.start)}</p>
								</div>
								{#if event.coordinates}
									<button
										class="shrink-0 bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-400"
										type="button"
										onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
									>
										Map
									</button>
								{:else}
									<span class="shrink-0 bg-neutral-800 px-3 py-1 text-xs text-neutral-400">Unmapped</span>
								{/if}
							</div>

							{#if event.location}
								<p class="mt-3 text-sm font-medium text-neutral-200">{event.location}</p>
							{/if}

							{#if event.description}
								<p class="mt-2 text-sm leading-6 text-neutral-400">{descriptionPreview(event.description)}</p>
							{/if}

							{#if event.url}
								<a class="mt-3 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200" href={event.url} target="_blank" rel="noreferrer">
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
