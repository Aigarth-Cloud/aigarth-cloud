// Build app/favicon.ico from the same icon design as app/icon.svg.
//
// Uses next/og's ImageResponse (Satori under the hood) to rasterise the
// icon at 16/32/48 px, then packs all three PNGs into a multi-resolution
// ICO container (PNG-in-ICO works on every browser since Windows Vista).
//
// Why no static .ico?
//   No image-magick, sharp, or other rasteriser in the monorepo. next/og
//   ships with Next.js itself, so we get a real ICO without a new dep.
//
// This script is .cjs (not .mjs) and uses React.createElement for every
// SVG primitive so plain Node can run it without a JSX transpiler.

const fs = require("fs");
const path = require("path");
const React = require("react");

const h = React.createElement;

function buildIconTree(size) {
  // 64-unit viewBox; scale the inner SVG to ~78% of the canvas
  const inner = Math.round(size * 0.78);

  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(180deg, #F0F7F2 0%, #D7E9D8 100%)",
        borderRadius: Math.max(2, Math.round(size * 0.22)),
      },
    },
    h(
      "svg",
      {
        viewBox: "0 0 64 64",
        width: inner,
        height: inner,
        xmlns: "http://www.w3.org/2000/svg",
      },
      h(
        "defs",
        null,
        h(
          "linearGradient",
          {
            id: "aigarthA",
            x1: "0",
            y1: "0",
            x2: "0",
            y2: "1",
          },
          h("stop", { offset: "0%", stopColor: "#5eaaa8" }),
          h("stop", { offset: "100%", stopColor: "#2E7D32" })
        )
      ),
      h(
        "g",
        { fill: "url(#aigarthA)" },
        h("polygon", { points: "11,58 19,58 35,8 30,8" }),
        h("polygon", { points: "45,58 53,58 34,8 29,8" }),
        h("ellipse", { cx: 32, cy: 40, rx: 14, ry: 3.2 }),
        h("path", {
          d: "M32 18 C 36 20 36 26 32 28 C 28 26 28 20 32 18 Z",
          opacity: 0.85,
        })
      )
    )
  );
}

async function buildFavicon() {
  // next/og is published as a CJS file (next/og.js). Node's ESM resolver
  // requires the .js extension for bare specifiers inside dynamic import,
  // so we point at the explicit file.
  const { ImageResponse } = await import("next/og.js");

  const renderIcon = async (size) => {
    const resp = new ImageResponse(buildIconTree(size), {
      width: size,
      height: size,
    });
    const ab = await resp.arrayBuffer();
    return Buffer.from(ab);
  };

  const png16 = await renderIcon(16);
  const png32 = await renderIcon(32);
  const png48 = await renderIcon(48);

  // ICO container
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * 3;
  const totalSize = dataOffset + png16.length + png32.length + png48.length;

  const buf = Buffer.alloc(totalSize);
  let p = 0;

  // ICONDIR
  buf.writeUInt16LE(0, p); p += 2; // reserved
  buf.writeUInt16LE(1, p); p += 2; // type 1 = icon
  buf.writeUInt16LE(3, p); p += 2; // count

  // ICONDIRENTRY × 3
  const entries = [
    { png: png16, size: 16, off: dataOffset },
    { png: png32, size: 32, off: dataOffset + png16.length },
    {
      png: png48,
      size: 48,
      off: dataOffset + png16.length + png32.length,
    },
  ];
  for (const e of entries) {
    buf.writeUInt8(e.size === 256 ? 0 : e.size, p); p += 1;
    buf.writeUInt8(e.size === 256 ? 0 : e.size, p); p += 1;
    buf.writeUInt8(0, p); p += 1; // color count
    buf.writeUInt8(0, p); p += 1; // reserved
    buf.writeUInt16LE(1, p); p += 2; // planes
    buf.writeUInt16LE(32, p); p += 2; // bit count
    buf.writeUInt32LE(e.png.length, p); p += 4; // bytes in res
    buf.writeUInt32LE(e.off, p); p += 4; // image offset
  }

  // image data
  png16.copy(buf, dataOffset);
  png32.copy(buf, dataOffset + png16.length);
  png48.copy(buf, dataOffset + png16.length + png32.length);

  const out = path.join(__dirname, "..", "app", "favicon.ico");
  fs.writeFileSync(out, buf);
  console.log(
    `favicon.ico written: ${buf.length} bytes (16/32/48 PNG-in-ICO)`
  );
}

buildFavicon().catch((err) => {
  console.error(err);
  process.exit(1);
});
