import type { PageLoad } from './$types';
// import ICAL from 'ical.js';
import * as ICAL from 'cal-parser'

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch('https://www.shift2bikes.org/cal/shift-calendar.php');
	const ical = await res.text();

  const ical_parsed = ICAL.parseString(ical);
  // const calendar = ical_parsed.calendarData;
  // const events = ical_parsed.events;

  const events = ical_parsed.events.filter(obj => {
    return new Date(obj.dtstart.value).getTime() > new Date().getTime();
  });

  console.log(events);

  // Get start and end dates as local time on current machine
  // console.log(event.startDate.toJSDate(), event.endDate.toJSDate());

	return { events };
};