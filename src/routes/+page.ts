import type { PageLoad } from './$types';
// import ICAL from 'ical.js';
import * as ICAL from 'cal-parser';
import { config, geocoding, coordinates } from '@maptiler/client';

config.apiKey = 'QeycPm3IkJZ8kpEiIzxC';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch('https://www.shift2bikes.org/cal/shift-calendar.php');
	const ical = await res.text();

  const ical_parsed = ICAL.parseString(ical);
  // const calendar = ical_parsed.calendarData;
  // const events = ical_parsed.events;

  const events = ical_parsed.events.filter(obj => {
    const event_date = new Date(obj.dtstart.value);
    const now_date = new Date();
    const end_date = new Date();
    end_date.setDate(now_date.getDate() + 7);

    return (event_date.getTime() > now_date.getTime()) && (event_date.getTime() < end_date.getTime());
  });

  // console.log(events);

  const locations = [];

  // loop over events
  events.forEach((event, index) => {
    if(index < 3) { 
      console.log(event)
      let location = event.location.value;
      // check if location contains "portland"
      // if not add " portland, oregon" to the end of the string
      if (!location.includes('portland') && !location.includes('Portland')) {
        location += ' portland, or';
      }

      locations.push(location);
    }
  })

  console.log(locations)
  // concatenate location values into string of 50 or less locations
  // pass string to batch geocoding method
  // loop over result and push lnglats to empty lnglats array

  // let locations = [ 'dallas', 'seattle', 'portland', 'kansas city', 'los angeles' ]

  const lnglats = [];

  // const result = await geocoding.forward("paris");
  // let result = getGeocoded();

  // const result = async () => {
    // locations.forEach((loc) => {
      const geocoded = await geocoding.batch(locations, { country: ['us'], proximity: [-122.676483, 45.523064] });

      console.log(geocoded)

      geocoded.forEach((g) => {
        if(g.features[0].geometry.type === 'Point') {
          const coordinates = g.features[0].geometry.coordinates;
          console.log(coordinates)
          lnglats.push(coordinates);
        }
      })

      // if(geocoded.features[0].geometry.type === 'Point') {
      //   console.log(geocoded.features[0].geometry.coordinates)
      //   loc.lnglat = geocoded.features[0].geometry.coordinates;
      // }
    // })
    
    // return geocoded.features[0].geometry.coordinates
  // }

  // let lnglat = $state([
  //   { lng: result[0], lat: result[1] },
  //   { lng: -122.1770818, lat: 48.0517637 },
  //   { lng: -117.22864779999999, lat: 33.7825194 },
  //   { lng: -81.6943605, lat: 41.499320000000004 },
  // ]);

	return { events, lnglats };
}