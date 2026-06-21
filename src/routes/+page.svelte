<script lang="ts">
	import type { PageProps } from './$types';
  import maplibregl from 'maplibre-gl';
  import { MapLibre, Marker, NavigationControl, ScaleControl, GlobeControl } from 'svelte-maplibre-gl';

	let { data }: PageProps = $props();

  
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
  <!-- {#await } -->
  {#each data.lnglats as lnglat}
  <Marker lnglat={lnglat}>
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