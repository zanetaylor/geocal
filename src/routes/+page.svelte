<script lang="ts">
	import type { PageProps } from './$types';
	import { Copy, Link, MapPin, Upload } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { MapLibre, Marker, NavigationControl, Popup, ScaleControl } from 'svelte-maplibre-gl';

	let { data, form }: PageProps = $props();
	let selectedId = $state<string | null>(null);
	let sourceMode = $state<'url' | 'file'>('url');
	let timeZone = $state('UTC');
	let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let calendar = $derived(form ?? data);

	let mappedEvents = $derived(calendar.events.filter((event) => event.coordinates));
	let unmappedCount = $derived(calendar.events.length - mappedEvents.length);
	let canCopyLink = $derived(Boolean(calendar.sourceUrl && !calendar.feedError));
	let eventSummary = $derived(
		`${mappedEvents.length} mapped / ${calendar.events.length} events from ${formatDateOnly(calendar.startDate)} to ${formatDateOnly(calendar.endDate)}${
			unmappedCount > 0 ? ` - ${unmappedCount} not mapped` : ''
		}`
	);

	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: '2-digit'
	});
	const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: '2-digit',
		hour: 'numeric',
		minute: '2-digit'
	});

	function formatDateOnly(value: string) {
		return dateFormatter.format(new Date(`${value}T00:00:00`));
	}

	function formatDate(value: string) {
		return dateTimeFormatter.format(new Date(value));
	}

	function descriptionPreview(value: string) {
		return value.length > 220 ? `${value.slice(0, 220).trim()}...` : value;
	}

	function buildShareUrl() {
		const shareUrl = new URL(window.location.href);

		shareUrl.search = '';
		shareUrl.searchParams.set('feedUrl', calendar.sourceUrl);
		shareUrl.searchParams.set('start', calendar.startDate);
		shareUrl.searchParams.set('end', calendar.endDate);
		shareUrl.searchParams.set('timeZone', calendar.timeZone);

		return shareUrl.toString();
	}

	async function copyShareLink() {
		if (!canCopyLink) return;

		try {
			const shareUrl = buildShareUrl();

			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareUrl);
			} else {
				const textarea = document.createElement('textarea');

				textarea.value = shareUrl;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.append(textarea);
				textarea.select();
				document.execCommand('copy');
				textarea.remove();
			}

			copyStatus = 'copied';
			window.setTimeout(() => (copyStatus = 'idle'), 1800);
		} catch {
			copyStatus = 'error';
		}
	}

	onMount(() => {
		timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
	});
</script>

<svelte:head>
	<title>geocal - calendar → map</title>
	<meta
		name="description"
		content="Interactive map of events from an iCal feed or uploaded iCal file."
	/>
</svelte:head>

<main
	class="min-h-screen bg-neutral-950 bg-[url($lib/assets/img/cartographer.png)] text-neutral-100"
>
	<section class="bg-[#00000060] px-4 py-5 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
		<div class="mx-auto flex max-w-screen-2xl flex-col gap-5">
			<div>
				<h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">geocal</h1>
				<p class="mt-2 max-w-2xl text-sm text-neutral-300">
					Enter a public ICS feed URL or upload an .ics file and select a date range to plot the
					events on the map.
				</p>
			</div>

			<form
				method="POST"
				enctype="multipart/form-data"
				class="grid w-full grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[auto_minmax(14rem,2fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto_auto]"
			>
				<input type="hidden" name="timeZone" value={timeZone} />
				<div class="grid gap-1.5 text-sm font-medium text-neutral-200">
					<span>Source</span>
					<div class="flex h-12 overflow-hidden rounded-xs bg-neutral-800 p-1 sm:h-11">
						<button
							class={`flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold transition ${
								sourceMode === 'url'
									? 'bg-neutral-700 text-teal-500'
									: 'bg-transparent text-neutral-200 hover:text-teal-500'
							}`}
							type="button"
							onclick={() => (sourceMode = 'url')}
							aria-pressed={sourceMode === 'url'}
						>
							<Link class="h-4 w-4" aria-hidden="true" />
							URL
						</button>
						<button
							class={`flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-semibold transition ${
								sourceMode === 'file'
									? 'bg-neutral-700 text-teal-500'
									: 'bg-transparent text-neutral-200 hover:text-teal-500'
							}`}
							type="button"
							onclick={() => (sourceMode = 'file')}
							aria-pressed={sourceMode === 'file'}
						>
							<Upload class="h-4 w-4" aria-hidden="true" />
							File
						</button>
					</div>
				</div>
				{#if sourceMode === 'url'}
					<label
						class="grid gap-1.5 text-sm font-medium text-neutral-200 sm:col-span-2 lg:col-span-1"
					>
						<span>Public ICS feed URL</span>
						<input
							class="h-12 min-w-0 rounded-xs bg-neutral-800 px-3 text-base text-neutral-100 ring-teal-300/40 transition outline-none placeholder:text-neutral-500 focus:ring-4 sm:h-11 sm:text-sm"
							type="url"
							name="feedUrl"
							value={calendar.sourceUrl}
							placeholder="https://example.com/calendar.ics"
						/>
					</label>
				{:else}
					<label
						class="grid gap-1.5 text-sm font-medium text-neutral-200 sm:col-span-2 lg:col-span-1"
					>
						<span>ICS file</span>
						<input
							class="h-12 min-w-0 rounded-xs bg-neutral-800 px-3 text-sm text-neutral-100 outline-none file:mr-3 file:h-9 file:rounded-xs file:border-0 file:bg-teal-500 file:px-3 file:font-semibold file:text-neutral-950 file:hover:bg-teal-400 sm:h-11 sm:file:h-8"
							type="file"
							name="calendarFile"
							accept=".ics,text/calendar"
						/>
					</label>
				{/if}
				<div class="grid grid-cols-2 gap-3 sm:contents">
					<label class="grid gap-1.5 text-sm font-medium text-neutral-200">
						<span>Start</span>
						<input
							class="h-12 min-w-0 rounded-xs bg-neutral-800 px-3 text-base text-neutral-100 ring-teal-300/40 transition outline-none focus:ring-4 sm:h-11 sm:text-sm"
							type="date"
							name="start"
							value={calendar.startDate}
						/>
					</label>
					<label class="grid gap-1.5 text-sm font-medium text-neutral-200">
						<span>End</span>
						<input
							class="h-12 min-w-0 rounded-xs bg-neutral-800 px-3 text-base text-neutral-100 ring-teal-300/40 transition outline-none focus:ring-4 sm:h-11 sm:text-sm"
							type="date"
							name="end"
							value={calendar.endDate}
						/>
					</label>
				</div>
				<div class="flex gap-3 sm:col-span-2 lg:col-span-2">
					<button
						class="h-12 flex-1 cursor-pointer rounded-xs bg-teal-500 px-4 font-semibold text-neutral-950 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] transition hover:bg-teal-400 sm:h-11"
						type="submit"
					>
						Go!
					</button>
					<button
						class={`flex h-12 w-12 items-center justify-center rounded-xs font-semibold transition sm:h-11 sm:w-11 ${
							canCopyLink
								? 'cursor-pointer bg-neutral-800 text-teal-300 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] hover:bg-neutral-700 hover:text-teal-200'
								: 'cursor-not-allowed bg-neutral-900 text-neutral-600'
						}`}
						type="button"
						disabled={!canCopyLink}
						onclick={copyShareLink}
						aria-label={copyStatus === 'copied'
							? 'Link copied'
							: copyStatus === 'error'
								? 'Copy failed'
								: canCopyLink
									? 'Copy link'
									: 'Load a feed URL to copy a link'}
						title={copyStatus === 'copied'
							? 'Link copied'
							: copyStatus === 'error'
								? 'Copy failed'
								: canCopyLink
									? 'Copy link'
									: 'Load a feed URL to copy a link'}
					>
						<Copy class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			</form>
		</div>
	</section>

	<section
		class="relative h-[68vh] min-h-[540px] overflow-hidden bg-neutral-900 shadow-2xl shadow-black/30 sm:h-[calc(100vh-268px)] sm:min-h-[620px]"
	>
		<div class="absolute inset-0">
			<MapLibre
				class="h-full w-full"
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
								class="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-neutral-950 ring-2 ring-teal-100/65 transition hover:scale-110"
								type="button"
								title={event.title}
								aria-label={event.title}
								onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
							>
								<MapPin class="h-4 w-4" aria-hidden="true" />
							</button>
						{/snippet}
					</Marker>

					<Popup
						lnglat={event.coordinates}
						open={selectedId === event.id}
						offset={24}
						class="max-w-xs text-neutral-950"
					>
						<div class="space-y-2 p-1">
							<h3 class="leading-tight font-semibold">{event.title}</h3>
							<p class="text-sm text-neutral-600">{formatDate(event.start)}</p>
							<p class="text-sm">{event.location}</p>
							{#if event.url}
								<a
									class="text-sm font-semibold text-teal-700 underline"
									href={event.url}
									target="_blank"
									rel="noreferrer">Source event</a
								>
							{/if}
						</div>
					</Popup>
				{/each}
			</MapLibre>
		</div>

		<aside
			class="absolute inset-x-2 bottom-2 z-10 flex max-h-[45%] flex-col overflow-hidden rounded-xs bg-neutral-950/85 backdrop-blur sm:inset-x-4 sm:bottom-4 sm:max-h-[48%] lg:inset-x-auto lg:inset-y-8 lg:left-8 lg:max-h-none lg:w-[420px]"
		>
			<div class="p-3 sm:p-4">
				<h2 class="text-lg font-semibold sm:text-xl">Events</h2>
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
				<div class="bg-red-800 p-3 text-sm text-neutral-300">
					Load feed URL or upload a file to map events.
				</div>
			{:else}
				<div class="flex-1 divide-y divide-neutral-800 overflow-auto">
					{#each calendar.events as event (event.id)}
						<article
							class={`p-4 transition hover:bg-neutral-800/60 ${selectedId === event.id ? 'bg-neutral-800' : ''}`}
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="leading-tight font-semibold">{event.title}</h3>
									<p class="mt-1 text-sm text-neutral-300">{formatDate(event.start)}</p>
								</div>
								{#if event.coordinates}
									<button
										class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xs bg-teal-500 text-neutral-950 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] transition hover:bg-teal-400"
										type="button"
										aria-label={`Show ${event.title} on map`}
										title="Show on map"
										onclick={() => (selectedId = selectedId === event.id ? null : event.id)}
									>
										<MapPin class="h-4 w-4" aria-hidden="true" />
									</button>
								{:else}
									<span class="shrink-0 bg-neutral-800 px-3 py-1 text-xs text-neutral-400"
										>Unmapped</span
									>
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
					{/each}
				</div>
			{/if}
		</aside>
	</section>
</main>
