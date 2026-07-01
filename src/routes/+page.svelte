<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { Copy, Link, MapPin, Maximize2, Minimize2, Upload } from '@lucide/svelte';
	import EventsPanel from '$lib/components/EventsPanel.svelte';
	import {
		buildShareUrl as buildShareUrlFromState,
		createDateTimeFormatter,
		formatDate as formatDateWithFormatter,
		formatDateOnly,
		readFullscreenSearchParam,
		setFullscreenSearchParam
	} from '$lib/calendar/presentation';
	import { onMount } from 'svelte';
	import { MapLibre, Marker, NavigationControl, Popup, ScaleControl } from 'svelte-maplibre-gl';
	import Brand from '$lib/assets/svg/mark.svg.svelte';

	let { data, form }: PageProps = $props();
	let selectedId = $state<string | null>(null);
	let sourceMode = $state<'url' | 'file'>('url');
	let timeZone = $state('UTC');
	let isFullscreen = $state(readFullscreenSearchParam(page.url.searchParams));
	let isEventsCollapsed = $state(false);
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
	const COPY_STATUS_RESET_DELAY_MS = 1800;

	const dateTimeFormatter = $derived(createDateTimeFormatter(calendar.timeZone));

	function formatDate(value: string) {
		return formatDateWithFormatter(value, dateTimeFormatter);
	}

	function buildShareUrl() {
		return buildShareUrlFromState({
			currentHref: window.location.href,
			sourceUrl: calendar.sourceUrl,
			startDate: calendar.startDate,
			endDate: calendar.endDate,
			timeZone: calendar.timeZone,
			isFullscreen
		});
	}

	function writeFullscreenSearchParam(value: boolean) {
		const url = setFullscreenSearchParam(window.location.href, value);

		window.history.replaceState(window.history.state, '', url);
	}

	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
		writeFullscreenSearchParam(isFullscreen);
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
			window.setTimeout(() => (copyStatus = 'idle'), COPY_STATUS_RESET_DELAY_MS);
		} catch {
			copyStatus = 'error';
		}
	}

	onMount(() => {
		timeZone =
			calendar.timeZone !== 'UTC'
				? calendar.timeZone
				: Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
	});
</script>

<svelte:head>
	<title>geocal // calendar → map</title>
	<meta
		name="description"
		content="Interactive map of events from an iCal feed or uploaded iCal file."
	/>
</svelte:head>

<main
	class="min-h-screen bg-neutral-950 bg-[url($lib/assets/img/cartographer.png)] text-neutral-100"
>
	<section class="bg-[#00000060] p-4 shadow-2xl shadow-black/20 sm:p-6 lg:p-4">
		<div class="mx-auto flex max-w-screen-2xl flex-col gap-5">
			<div class="flex items-start justify-between gap-4">
				<div>
					<Brand />
					<!-- <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">geocal</h1> -->
					<p class="mt-2 text-sm text-neutral-300">
						Enter a public ICS feed URL or upload an .ics file and select a date range to plot the
						events on the map.
					</p>
				</div>
				<a
					class="mt-1 shrink-0 text-teal-300 transition hover:text-teal-200 focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-teal-300"
					href="https://github.com/zanetaylor/geocal"
					target="_blank"
					rel="noreferrer"
					aria-label="Open geocal on GitHub"
					title="Open geocal on GitHub"
				>
					<svg class="block h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
						/>
					</svg>
				</a>
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
		class={`overflow-hidden bg-neutral-900 shadow-2xl shadow-black/30 ${
			isFullscreen
				? 'fixed inset-0 isolate z-[1000] h-[100dvh] min-h-[100dvh]'
				: 'relative h-[68vh] min-h-135 sm:h-[calc(100vh-268px)] sm:min-h-155'
		}`}
	>
		<div class="absolute inset-0">
			<MapLibre
				class="h-full w-full"
				style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
				zoom={11}
				center={{ lng: -122.676483, lat: 45.523064 }}
			>
				<NavigationControl position="bottom-right" />
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

		<div class="absolute top-2 right-2 z-20 flex gap-2 sm:top-4 sm:right-4">
			<button
				class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xs bg-neutral-950/85 text-teal-300 shadow-[inset_0_-4px_0_rgba(0,0,0,0.22)] backdrop-blur transition hover:bg-neutral-800 hover:text-teal-200 focus:ring-4 focus:ring-teal-300/40 focus:outline-none"
				type="button"
				onclick={toggleFullscreen}
				aria-pressed={isFullscreen}
				aria-label={isFullscreen ? 'Exit fullscreen map' : 'Open fullscreen map'}
				title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
			>
				{#if isFullscreen}
					<Minimize2 class="h-4 w-4" aria-hidden="true" />
				{:else}
					<Maximize2 class="h-4 w-4" aria-hidden="true" />
				{/if}
			</button>
		</div>

		<EventsPanel
			events={calendar.events}
			warnings={calendar.warnings}
			feedError={calendar.feedError}
			{selectedId}
			isCollapsed={isEventsCollapsed}
			{eventSummary}
			{formatDate}
			onToggleCollapsed={() => (isEventsCollapsed = !isEventsCollapsed)}
			onToggleSelected={(id) => (selectedId = selectedId === id ? null : id)}
		/>
	</section>
</main>
