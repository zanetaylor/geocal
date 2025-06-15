<script lang="ts">
	import type { PageProps } from './$types';
  import maplibregl from 'maplibre-gl';
  import { MapLibre, Marker, NavigationControl, ScaleControl, GlobeControl } from 'svelte-maplibre-gl';
  import { config, geocoding, coordinates } from '@maptiler/client';

  config.apiKey = 'QeycPm3IkJZ8kpEiIzxC';

	let { data }: PageProps = $props();

  let locations = [
    'dallas',
    'seattle',
    'portland',
    'kansas city',
    'los angeles'
  ]

  // const result = await geocoding.forward("paris");
  let result = getGeocoded();

  async function getGeocoded() {
    const geocoded = await geocoding.forward("paris");
    console.log(geocoded.features[0].geometry.coordinates)
    return geocoded.features[0].geometry.coordinates
  }

  

  let lnglat = $state([
    { lng: result[0], lat: result[1] },
    { lng: -122.1770818, lat: 48.0517637 },
    { lng: -117.22864779999999, lat: 33.7825194 },
    { lng: -81.6943605, lat: 41.499320000000004 },
  ]);
  // let lngLatText = $derived(`(${lnglat.lat.toFixed(3)}, ${lnglat.lng.toFixed(3)})`);
  let popupOpen = $state(true);
  let offset = $state(24);
</script>

<h3>Events</h3>

<MapLibre
  class="h-[55vh] min-h-[300px]"
  style="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
  zoom={3.5}
  center={{ lng: 137, lat: 36 }}
>
  <NavigationControl />
  <ScaleControl />
  <GlobeControl />

  <!-- {#await } -->
  {#each lnglat as ll}
  <Marker lnglat={ll} draggable>
    {#snippet content()}
      <div class="text-center leading-none">
        <div class="text-3xl">🐶</div>
        <!-- <div class="font-bold text-white drop-shadow-xs">{lngLatText}</div> -->
      </div>
    {/snippet}
    <!-- <Popup class="text-black" bind:open={popupOpen} offset={offsets}>
      <span class="text-lg">{lngLatText}</span>
    </Popup> -->
  </Marker>
  {/each}
</MapLibre>

<dl>
<!-- dtstart, dtend, summary, description, location -->
{#each data.events as event }

<dt>{event.summary.value} - {event.dtstart.value}</dt>
<dd>
  <span>{event.location.value}</span>
  <p>{event.description.value}</p>
</dd>

{/each}
</dl>