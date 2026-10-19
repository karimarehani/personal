export type MapPlace = { lat?: number; lon?: number; name?: string; text?: string; sourceUrl?: string };
type PhotonFeature = { properties?: Record<string, string>; geometry: { coordinates: number[] } };
const placesCache = new Map<string, { expires: number; data: unknown }>();
const pendingPlaces = new Map<string, Promise<{ features?: PhotonFeature[] }>>();
async function photon(url: URL) {
  const cached = placesCache.get(url.href); if (cached && cached.expires > Date.now()) return cached.data as { features?: PhotonFeature[] };
  const existing = pendingPlaces.get(url.href); if (existing) return existing;
  const pending = (async () => {
    const r = await fetch(url.href, { signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error('Recherche de lieu indisponible. Saisissez les coordonnées GPS ou les kilomètres.');
    const data = await r.json() as { features?: PhotonFeature[] };
    if (placesCache.size >= 200) placesCache.delete(placesCache.keys().next().value!);
    placesCache.set(url.href, { expires: Date.now() + 600000, data }); return data;
  })();
  pendingPlaces.set(url.href, pending);
  try { return await pending; } finally { pendingPlaces.delete(url.href); }
}
export async function searchMapPlaces(q: string, bias?: { lat: number; lon: number }) {
  if (!q.trim() || q.length > 500) throw new Error('Nom de destination invalide.');
  const u = new URL('https://photon.komoot.io/api/');
  u.search = new URLSearchParams({ q, limit: '12', lang: 'fr', bbox: '-17.5,20.5,-0.9,36.1', lat: String(bias?.lat ?? 33.57), lon: String(bias?.lon ?? -7.59) }).toString();
  const filter = (data: { features?: PhotonFeature[] }) => (data.features || []).filter(f => f.properties?.countrycode?.toUpperCase() === 'MA').slice(0, 7);
  try { const places = filter(await photon(u)); if (places.length) return places; } catch {}
  u.search = new URLSearchParams({ q, limit: '3', lang: 'fr' }).toString();
  return filter(await photon(u));
}
export async function reverseMapPlace(lat: number, lon: number) {
  if (!validCoords(lat, lon)) throw new Error('Coordonnées GPS invalides.');
  const u = new URL('https://photon.komoot.io/reverse'); u.search = new URLSearchParams({ lat: String(lat), lon: String(lon), lang: 'fr' }).toString();
  const data = await photon(u); return data.features?.[0] || null;
}
export function validCoords(lat: number, lon: number) { return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180; }
export function permittedMapsUrl(value: string): URL {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) throw new Error('Lien Google Maps invalide.');
  const short = u.hostname === 'maps.app.goo.gl' || u.hostname === 'goo.gl' && u.pathname.startsWith('/maps');
  const long = /^(?:www\.|maps\.)?google\.(?:com|fr|co\.ma|ma|co\.uk|es|de)$/.test(u.hostname) && (u.pathname.startsWith('/maps') || u.hostname.startsWith('maps.'));
  if (!short && !long) throw new Error('Utilisez un lien Google Maps.');
  return u;
}
export function placeFromUrl(value: string): MapPlace | null {
  const u = permittedMapsUrl(value), v = decodeURIComponent(u.href);
  let name = (v.match(/\/place\/([^/@?]+)/) || [])[1]?.replace(/\+/g, ' ') || '';
  const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination') || u.searchParams.get('daddr') || '';
  const pair = v.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (pair && validCoords(+pair[1], +pair[2])) return { lat: +pair[1], lon: +pair[2], name, sourceUrl: u.href };
  if (name || q && !q.startsWith('place_id:')) return { text: name || q, sourceUrl: u.href };
  const center = v.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (center && validCoords(+center[1], +center[2])) return { lat: +center[1], lon: +center[2], sourceUrl: u.href };
  return null;
}
export async function resolveMaps(value: string): Promise<MapPlace> {
  let url = permittedMapsUrl(value); const direct = placeFromUrl(url.href);
  if (direct?.lat !== undefined) return direct;
  for (let hop = 0; hop < 6; hop++) {
    const r = await fetch(url.href, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'Accept-Language': 'fr', Accept: 'text/html' } });
    if (r.status >= 300 && r.status < 400) { const location = r.headers.get('location'); if (!location) break; url = permittedMapsUrl(new URL(location, url).href); const p = placeFromUrl(url.href); if (p) return p; continue; }
    const p = placeFromUrl(url.href); if (p) return p;
    if (!r.ok) throw new Error('Google Maps ne permet pas d’ouvrir ce lien pour le moment.');
    const html = (await r.text()).slice(0, 1_000_000);
    const canonical = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] || html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
    if (canonical) { try { const p = placeFromUrl(canonical.replace(/&amp;/g, '&')); if (p) return p; } catch {} }
    const title = html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (title && !/^Google Maps$/i.test(title)) return { text: title.replace(/\s*[-–]\s*Google Maps$/i, '').replace(/&amp;/g, '&'), sourceUrl: url.href };
    break;
  }
  if (direct?.text) return direct;
  throw new Error('Le lieu n’a pas pu être identifié. Saisissez son nom ou ses coordonnées GPS.');
}
export async function roadDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  if (!validCoords(a.lat, a.lon) || !validCoords(b.lat, b.lon)) throw new Error('Coordonnées GPS invalides.');
  for (const base of ['https://router.project-osrm.org/route/v1/driving/', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/']) {
    try { const r = await fetch(`${base}${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { signal: AbortSignal.timeout(10000) }); if (!r.ok) continue; const j = await r.json() as { routes?: { distance: number }[] }; if (j.routes?.[0] && Number.isFinite(j.routes[0].distance)) return { km: Math.round(j.routes[0].distance / 10) / 100, source: 'OpenStreetMap' }; } catch {} }
  throw new Error('Calcul routier indisponible. Vous pouvez saisir les kilomètres manuellement.');
}
