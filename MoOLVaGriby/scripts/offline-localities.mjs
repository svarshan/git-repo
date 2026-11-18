import {open, writeFile} from 'node:fs/promises';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {PMTiles} from 'pmtiles';

const [archive, output] = process.argv.slice(2);
if (!archive || !output) throw new Error('Usage: node scripts/offline-localities.mjs <archive.pmtiles> <output.js>');

const zoom = 13;
const world = 2 ** zoom;
const tileX = longitude => Math.floor((longitude + 180) / 360 * world);
const tileY = latitude => Math.floor((1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2 * world);
const kinds = new Set(['city', 'town', 'village', 'hamlet', 'isolated_dwelling', 'locality']);
const file = await open(archive, 'r');
const {size} = await file.stat();
const tiles = new PMTiles({
  getKey: () => archive,
  async getBytes(offset, length) {
    const data = new Uint8Array(Math.min(length, size - offset));
    let filled = 0;
    while (filled < data.length) {
      const {bytesRead} = await file.read(data, filled, data.length - filled, offset + filled);
      if (!bytesRead) throw new Error('Incomplete PMTiles read');
      filled += bytesRead;
    }
    return {data: data.buffer};
  }
});

const entries = new Map();
try {
  const extent = await tiles.getHeader();
  for (let x = tileX(extent.minLon); x <= tileX(extent.maxLon); x++) {
    for (let y = tileY(extent.maxLat); y <= tileY(extent.minLat); y++) {
      const tile = await tiles.getZxy(zoom, x, y);
      if (!tile) continue;
      const {places} = new VectorTile(new Pbf(tile.data)).layers;
      if (!places) continue;
      for (let index = 0; index < places.length; index++) {
        const feature = places.feature(index);
        const props = feature.properties;
        const name = props['name:ru'] || props.name;
        const kind = props.kind_detail || props.kind;
        if (!name || !kinds.has(kind) || feature.type !== 1) continue;
        const [lon, lat] = feature.toGeoJSON(x, y, zoom).geometry.coordinates;
        if (lon < extent.minLon || lon > extent.maxLon || lat < extent.minLat || lat > extent.maxLat) continue;
        // Only use the tile that owns the point, excluding overlapping tile buffers.
        if (tileX(lon) !== x || tileY(lat) !== y) continue;
        const key = `${name}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
        entries.set(key, [name, +lat.toFixed(5), +lon.toFixed(5), kind, Number(props.population_rank) || 0]);
      }
    }
  }
} finally {
  await file.close();
}

const rows = [...entries.values()].sort((a, b) => b[4] - a[4] || a[0].localeCompare(b[0], 'ru') || a[1] - b[1]);
if (rows.length < 100) throw new Error('Offline locality index is incomplete');
await writeFile(output, `/* © OpenStreetMap contributors. Data provided by Protomaps. ODbL 1.0. */\nwindow.MOOLVA_OFFLINE_LOCALITIES = ${JSON.stringify(rows)};\n`);
console.log(`Indexed ${rows.length} places.`);
