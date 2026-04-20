/**
 * Imports GeoNames data into Supabase:
 *   - countries   (from countryInfo.txt)
 *   - admin1      (from admin1CodesASCII.txt)
 *   - cities      (from cities15000.txt — cities with population > 15k, ~26k rows)
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... tsx scripts/import-geonames.ts
 *
 * Files are downloaded once and cached under scripts/geonames-cache/.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const CACHE = "scripts/geonames-cache";
const FILES = {
  countryInfo: "https://download.geonames.org/export/dump/countryInfo.txt",
  admin1:      "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
  cities:      "https://download.geonames.org/export/dump/cities15000.zip",
};

async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url: string, dest: string) {
  if (await exists(dest)) return;
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${url} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(CACHE, { recursive: true });
  await writeFile(dest, buf);
}

async function main() {
  await mkdir(CACHE, { recursive: true });

  const countryPath = join(CACHE, "countryInfo.txt");
  const admin1Path  = join(CACHE, "admin1CodesASCII.txt");
  const citiesZip   = join(CACHE, "cities15000.zip");
  const citiesTxt   = join(CACHE, "cities15000.txt");

  await Promise.all([
    download(FILES.countryInfo, countryPath),
    download(FILES.admin1,      admin1Path),
    download(FILES.cities,      citiesZip),
  ]);

  if (!(await exists(citiesTxt))) {
    console.log("↻ unzipping cities15000.zip");
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(citiesZip);
    zip.extractAllTo(CACHE, true);
  }

  // ---- countries
  {
    const text = await readFile(countryPath, "utf8");
    const rows = text
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"))
      .filter((c) => c[0] && c[4])
      .map((c) => ({ code: c[0], name: c[4] }));
    console.log(`↑ countries: ${rows.length}`);
    const { error } = await supabase.from("countries").upsert(rows, { onConflict: "code" });
    if (error) throw error;
  }

  // ---- admin1
  {
    const text = await readFile(admin1Path, "utf8");
    const rows = text
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\t"))
      .map((c) => {
        const [country, code] = c[0].split(".");
        return { country_code: country, code, name: c[1] };
      })
      .filter((r) => r.country_code && r.code);
    console.log(`↑ admin1: ${rows.length}`);
    // chunk uploads
    for (const batch of chunks(rows, 1000)) {
      const { error } = await supabase.from("admin1").upsert(batch, {
        onConflict: "country_code,code",
      });
      if (error) throw error;
    }
  }

  // ---- cities
  {
    const text = await readFile(citiesTxt, "utf8");
    const rows = text
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\t"))
      .map((c) => ({
        geonameid: Number(c[0]),
        name: c[1],
        country_code: c[8],
        admin1_code: c[10] || null,
        population: Number(c[14] || 0),
        lat: Number(c[4]) || null,
        lon: Number(c[5]) || null,
      }))
      .filter((r) => r.geonameid && r.country_code);
    console.log(`↑ cities: ${rows.length}`);
    for (const batch of chunks(rows, 1000)) {
      const { error } = await supabase.from("cities").upsert(batch, {
        onConflict: "geonameid",
      });
      if (error) throw error;
    }
  }

  console.log("done");
}

function* chunks<T>(arr: T[], size: number) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
