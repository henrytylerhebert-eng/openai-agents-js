// Real free data sources for Lafayette Parish, Louisiana

// ─── Iowa Mesonet LSR ─────────────────────────────────────────────────────────
// WFO=LCH (Lake Charles) covers Lafayette Parish

export interface LSRReport {
  id: string;
  time: string;
  size: string; // inches
  loc: string;
  state: string;
  lat: number;
  lon: number;
}

export async function fetchLSRHailReports(hours = 720): Promise<LSRReport[]> {
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.php?type=H&wfo=LCH&hours=${hours}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`LSR HTTP ${res.status}`);
    const data = (await res.json()) as { features?: unknown[] };
    return (data.features ?? []).map((f, i) => {
      const feat = f as {
        properties: Record<string, unknown>;
        geometry: { coordinates: [number, number] };
      };
      return {
        id: `lsr-${i}`,
        time: String(feat.properties.valid ?? ''),
        size: String(feat.properties.magnitude ?? '1.00'),
        loc: String(feat.properties.city ?? feat.properties.county ?? ''),
        state: String(feat.properties.state ?? 'LA'),
        lat: feat.geometry.coordinates[1],
        lon: feat.geometry.coordinates[0],
      };
    });
  } catch {
    return [];
  }
}

// ─── Lafayette Parish Assessor ArcGIS REST ────────────────────────────────────
// Public, no auth required — 117k+ residential parcels

export interface ParcelAddress {
  address: string;
  lat: number;
  lon: number;
  yearBuilt: number;
  owner: string;
  sqft: number;
}

export async function fetchParcelsByBbox(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  maxResults = 200,
): Promise<ParcelAddress[]> {
  const base =
    'https://webgis.lafayetteassessor.com/arcgis/rest/services/Sidwell/TaxParcelPublic/MapServer/0/query';
  const params = new URLSearchParams({
    geometry: `${minLon},${minLat},${maxLon},${maxLat}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'SitusAddress,YearBuilt,OwnerName1,LivingArea',
    returnGeometry: 'true',
    resultRecordCount: String(maxResults),
    f: 'json',
  });
  try {
    const res = await fetch(`${base}?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`Assessor HTTP ${res.status}`);
    const data = (await res.json()) as { features?: unknown[] };
    const results: ParcelAddress[] = [];
    for (const f of data.features ?? []) {
      const feat = f as {
        attributes: Record<string, unknown>;
        geometry: Record<string, unknown>;
      };
      const addr = String(feat.attributes.SitusAddress ?? '').trim();
      if (!addr || addr === 'null' || addr === '') continue;
      const geo = feat.geometry;
      // Point geometry uses x/y; polygon uses rings — compute centroid
      let lat = geo.y as number | undefined;
      let lon = geo.x as number | undefined;
      if (lat == null || lon == null) {
        const rings = geo.rings as number[][][] | undefined;
        const ring = rings?.[0];
        if (ring && ring.length > 0) {
          lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
          lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        }
      }
      if (!lat || !lon) continue;
      results.push({
        address: addr,
        lat,
        lon,
        yearBuilt: (feat.attributes.YearBuilt as number) ?? 0,
        owner: String(feat.attributes.OwnerName1 ?? ''),
        sqft: (feat.attributes.LivingArea as number) ?? 0,
      });
    }
    return results;
  } catch {
    return [];
  }
}
