/** @returns {{latitude:number,longitude:number}|null} */
export function parseCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null || String(latitude).trim() === '' || String(longitude).trim() === '') return null;
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

/** Build a validated longitude-first PostGIS point; reject incomplete coordinates. */
export function coordinateGeometry(latitude, longitude) {
  const point = parseCoordinates(latitude, longitude);
  return point ? `SRID=4326;POINT(${point.longitude} ${point.latitude})` : null;
}

/** Geographical coverage of operating assets; never count an absent point as (0,0). */
export function locationCoverage(assets) {
  const operating = assets.filter((asset) => asset.live_status !== 'retired' && asset.status !== 'retired');
  const located = operating.filter((asset) => parseCoordinates(asset.latitude, asset.longitude) !== null).length;
  return { total: operating.length, located, missing: operating.length - located, percent: operating.length ? Math.round(located / operating.length * 100) : 0 };
}
