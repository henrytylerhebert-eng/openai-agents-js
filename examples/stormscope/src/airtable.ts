// Airtable backend for Roof Oracle
// Base: appuHX1OJ9NITew6i (Lafayette Parish)

const BASE_ID = 'appWvKQDED7pDHRty';

let _token = '';

export function initAirtable(token: string) {
  _token = token;
}

export const isAirtableEnabled = () => !!_token;

type KnockStatus = 'unvisited' | 'knocked' | 'not_home' | 'interested' | 'skip';

async function at(table: string, path = '', opts: RequestInit = {}) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${_token}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return res.json();
}

// ─── Knocks ───────────────────────────────────────────────────────────────────

export interface KnockRecord {
  address: string;
  status: KnockStatus;
  stormDate: string;
  lat: number;
  lon: number;
  hailSize: number;
  roofAge: number;
  roofType: string;
  damageProb: number;
  notes?: string;
}

export async function fetchKnocks(
  stormDate: string,
): Promise<Record<string, KnockStatus>> {
  const formula = encodeURIComponent(`{Storm Date}='${stormDate}'`);
  const data = await at(
    'Knocks',
    `?filterByFormula=${formula}&fields[]=Address&fields[]=Status`,
  );
  const map: Record<string, KnockStatus> = {};
  for (const r of (data as { records?: { fields: Record<string, unknown> }[] })
    .records ?? []) {
    if (r.fields.Address && r.fields.Status) {
      map[r.fields.Address as string] = r.fields.Status as KnockStatus;
    }
  }
  return map;
}

export async function saveKnock(knock: KnockRecord): Promise<void> {
  await at('Knocks', '', {
    method: 'POST',
    body: JSON.stringify({
      records: [
        {
          fields: {
            Address: knock.address,
            Status: knock.status,
            'Storm Date': knock.stormDate,
            Lat: knock.lat,
            Lon: knock.lon,
            'Hail Size': knock.hailSize,
            'Roof Age': knock.roofAge,
            'Roof Type': knock.roofType,
            'Damage Prob': Math.round(knock.damageProb * 100),
            ...(knock.notes ? { Notes: knock.notes } : {}),
            'Knocked At': new Date().toISOString(),
          },
        },
      ],
    }),
  });
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export interface AirtableLead {
  id: string;
  address: string;
  homeowner: string;
  phone: string;
  status: string;
  contactPref: string;
  source: string;
  roofType: string;
  roofAge: number;
  sqft: number;
  estJobValue: number;
  hailMesh: number;
  damageProb: number;
  notes: string;
}

export async function fetchLeads(): Promise<AirtableLead[]> {
  const records: AirtableLead[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const data = (await at('Leads', `?${params}`)) as {
      records?: { id: string; fields: Record<string, unknown> }[];
      offset?: string;
    };

    for (const r of data.records ?? []) {
      const f = r.fields;
      records.push({
        id: r.id,
        address: (f['Address'] as string) ?? '',
        homeowner: (f['Homeowner'] as string) ?? '',
        phone: (f['Phone'] as string) ?? '',
        status: (f['Status'] as string) ?? 'new',
        contactPref: (f['Contact Pref'] as string) ?? 'phone',
        source: (f['Source'] as string) ?? 'Storm Canvass',
        roofType: (f['Roof Type'] as string) ?? '',
        roofAge: (f['Roof Age'] as number) ?? 0,
        sqft: (f['Sqft'] as number) ?? 0,
        estJobValue: (f['Est Job Value'] as number) ?? 0,
        hailMesh: (f['Hail Size MESH'] as number) ?? 0,
        damageProb: ((f['Damage Prob'] as number) ?? 0) / 100,
        notes: (f['Notes'] as string) ?? '',
      });
    }
    offset = data.offset;
  } while (offset);

  return records;
}
