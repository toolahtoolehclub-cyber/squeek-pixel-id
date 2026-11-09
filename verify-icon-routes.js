// Verify v42.5.3 Worker image routes against the esbuild bundle (local, no deploy).
// Run: node verify-icon-routes.js  (cwd = the v42.5.3 folder)
const fs = require('fs');

function pngDims(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function b64ToBuf(b64) { return Buffer.from(b64, 'base64'); }

(async () => {
  let pass = 0, fail = 0;
  const t = (name, ok) => { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } };

  const mod = await import('/tmp/v42.5.3-build/dist/worker.js');
  const worker = mod.default;
  const env = {}; // image + root routes need no D1

  const root = await worker.fetch(new Request('https://x/'), env);
  const rootJson = await root.json();
  t('GET / -> version 12', root.status === 200 && rootJson.version === 12);
  console.log('  GET /:', root.status, JSON.stringify(rootJson));

  const icon = await worker.fetch(new Request('https://x/icon.png'), env);
  const iconBuf = Buffer.from(await icon.arrayBuffer());
  const iconDims = pngDims(iconBuf);
  t('GET /icon.png -> 200 + image/png', icon.status === 200 && (icon.headers.get('content-type') || '').includes('image/png'));
  t('GET /icon.png -> valid PNG 512x512', !!iconDims && iconDims.w === 512 && iconDims.h === 512);
  t('GET /icon.png -> matches local icon file bytes', iconBuf.equals(fs.readFileSync('squeek-icon-512.png')));
  console.log('  GET /icon.png:', icon.status, icon.headers.get('content-type'), iconBuf.length, 'bytes, dims', JSON.stringify(iconDims), '| cache:', icon.headers.get('cache-control'));

  const og = await worker.fetch(new Request('https://x/og.png'), env);
  const ogBuf = Buffer.from(await og.arrayBuffer());
  const ogDims = pngDims(ogBuf);
  t('GET /og.png -> 200 + image/png', og.status === 200 && (og.headers.get('content-type') || '').includes('image/png'));
  t('GET /og.png -> valid PNG 1600x900', !!ogDims && ogDims.w === 1600 && ogDims.h === 900);
  t('GET /og.png -> matches local banner file bytes', ogBuf.equals(fs.readFileSync('squeekchain-headline-simple.png')));
  console.log('  GET /og.png:', og.status, og.headers.get('content-type'), ogBuf.length, 'bytes, dims', JSON.stringify(ogDims));

  // Old behavior intact: GET /cheese without wallet returns catalog JSON.
  const cheese = await worker.fetch(new Request('https://x/cheese'), env);
  const cheeseJson = await cheese.json();
  t('GET /cheese (no wallet) -> catalog intact', cheese.status === 200 && Array.isArray(cheeseJson.catalog) && cheeseJson.catalog.length > 0 && cheeseJson.balance === 0);
  console.log('  GET /cheese:', cheese.status, 'catalog items:', cheeseJson.catalog.length);

  // Unknown path still 404s (no accidental catch-all).
  const nope = await worker.fetch(new Request('https://x/does-not-exist'), env);
  t('GET /does-not-exist -> 404', nope.status === 404);
  console.log('  GET /does-not-exist:', nope.status);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
