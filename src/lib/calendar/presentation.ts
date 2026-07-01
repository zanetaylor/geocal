export const DESCRIPTION_PREVIEW_MAX_LENGTH = 220;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	month: 'numeric',
	day: 'numeric',
	year: '2-digit'
});

export type CalendarEventPresentation = {
	id: string;
	title: string;
	start: string;
	location?: string;
	description?: string;
	url?: string;
	coordinates?: unknown;
};

export type ShareUrlOptions = {
	currentHref: string;
	sourceUrl: string;
	startDate: string;
	endDate: string;
	timeZone: string;
	isFullscreen: boolean;
};

export function createDateTimeFormatter(timeZone: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'numeric',
		day: 'numeric',
		year: '2-digit',
		timeZone,
		hour: 'numeric',
		minute: '2-digit'
	});
}

export function formatDateOnly(value: string) {
	return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function formatDate(value: string, formatter: Intl.DateTimeFormat) {
	return formatter.format(new Date(value));
}

export function descriptionPreview(value: string) {
	return value.length > DESCRIPTION_PREVIEW_MAX_LENGTH
		? `${value.slice(0, DESCRIPTION_PREVIEW_MAX_LENGTH).trim()}...`
		: value;
}

export function buildShareUrl({
	currentHref,
	sourceUrl,
	startDate,
	endDate,
	timeZone,
	isFullscreen
}: ShareUrlOptions) {
	const shareUrl = new URL(currentHref);

	shareUrl.search = '';
	shareUrl.searchParams.set('feedUrl', sourceUrl);
	shareUrl.searchParams.set('start', startDate);
	shareUrl.searchParams.set('end', endDate);
	shareUrl.searchParams.set('timeZone', timeZone);
	if (isFullscreen) shareUrl.searchParams.set('fullscreen', 'true');

	return shareUrl.toString();
}

export function readFullscreenSearchParam(searchParams: URLSearchParams) {
	const value = searchParams.get('fullscreen');

	return value === 'true' || value === '1';
}

export function setFullscreenSearchParam(currentHref: string, value: boolean) {
	const url = new URL(currentHref);

	if (value) {
		url.searchParams.set('fullscreen', 'true');
	} else {
		url.searchParams.delete('fullscreen');
	}

	return url.toString();
}
