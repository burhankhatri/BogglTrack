// Generate all icon sizes + .icns + favicon + DMG background from the source SVG.
// Run: node scripts/build-icons.js

const sharp = require("sharp");
const png2icons = require("png2icons");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "electron", "assets", "source", "logo-tile.svg");
const SRC_MONO = path.join(__dirname, "..", "electron", "assets", "source", "logo.svg");
const OUT_APP = path.join(__dirname, "..", "electron", "assets");
const OUT_WEB = path.join(__dirname, "..", "public");
const OUT_APP_ICON = path.join(__dirname, "..", "src", "app");

const SIZES = [16, 32, 64, 128, 256, 512, 1024];

async function rasterize(srcPath, size, outPath) {
  await sharp(srcPath).resize(size, size).png().toFile(outPath);
}

async function main() {
  fs.mkdirSync(OUT_APP, { recursive: true });
  fs.mkdirSync(OUT_WEB, { recursive: true });

  // 1. App icon PNGs (tiled version, with FAFAFA bg)
  for (const s of SIZES) {
    await rasterize(SRC, s, path.join(OUT_APP, `icon-${s}.png`));
  }
  await rasterize(SRC, 1024, path.join(OUT_APP, "icon.png"));

  // 2. macOS .icns
  const base = fs.readFileSync(path.join(OUT_APP, "icon-1024.png"));
  const icns = png2icons.createICNS(base, png2icons.BICUBIC, 0);
  if (!icns) throw new Error("ICNS generation failed");
  fs.writeFileSync(path.join(OUT_APP, "icon.icns"), icns);
  console.log("✓ icon.icns written");

  // 3. Favicons for the web app (Next.js picks up src/app/icon.png + apple-icon.png)
  await rasterize(SRC, 512, path.join(OUT_APP_ICON, "icon.png"));
  await rasterize(SRC, 180, path.join(OUT_APP_ICON, "apple-icon.png"));
  await rasterize(SRC, 32, path.join(OUT_WEB, "favicon.png"));
  console.log("✓ favicons written");

  // 4. DMG background (660x400) — logo on the left, arrow area on the right.
  // We compose with sharp: a flat 660x400 rect, then a 128px logo overlaid at (180, 200).
  const bg = await sharp({
    create: { width: 660, height: 400, channels: 4, background: "#FAFAFA" },
  })
    .composite([
      {
        input: await sharp(SRC).resize(144, 144).png().toBuffer(),
        top: 130,
        left: 110,
      },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT_APP, "dmg-background.png"), bg);
  console.log("✓ dmg-background.png written");

  // 5. Tray icon (monochrome, template-style for macOS menu bar)
  await rasterize(SRC_MONO, 22, path.join(OUT_APP, "tray-iconTemplate.png"));
  await rasterize(SRC_MONO, 44, path.join(OUT_APP, "tray-iconTemplate@2x.png"));
  console.log("✓ tray icons written");

  console.log("\nAll icons generated successfully.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
