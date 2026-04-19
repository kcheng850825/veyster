/**
 * Generates icon-192.png and icon-512.png from public/icons/icon.svg.
 * Run once after cloning: `npx tsx scripts/generate-icons.ts`.
 * Requires `sharp` — installed on demand (not in package.json by default).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function run() {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default as typeof import("sharp");
  } catch {
    console.error(
      "Missing `sharp`. Install once with:\n\n  npm i -D sharp\n",
    );
    process.exit(1);
  }

  const root = process.cwd();
  const src = await readFile(join(root, "public/icons/icon.svg"));
  const outDir = join(root, "public/icons");
  await mkdir(outDir, { recursive: true });

  for (const size of [192, 512] as const) {
    const png = await sharp(src).resize(size, size).png().toBuffer();
    await writeFile(join(outDir, `icon-${size}.png`), png);
    console.log(`wrote icon-${size}.png`);
  }

  const apple = await sharp(src).resize(180, 180).png().toBuffer();
  await writeFile(join(outDir, "apple-touch-icon.png"), apple);
  console.log("wrote apple-touch-icon.png");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
