// `node src/utils/productImageFormat.selfcheck.mjs`
//
// canvas.toBlob silently returns a PNG when it cannot encode the type you asked for. Asking for WebP on a
// browser without a WebP encoder therefore produced a PNG, which the upload wrapped as `<name>.webp` with
// contentType 'image/webp'. Seven of twelve product images in the live bucket are PNGs under a .webp
// name: 200-900 kB against 7-69 kB for the ones that really are WebP.
//
// Measured in a browser with the real function, faking a missing encoder by making toBlob ignore the
// requested type:
//
//   source PNG 1172 kB
//   1. normal browser          -> image/webp   118 kB   .webp
//   2. no WebP encoder         -> image/jpeg   133 kB   .jpg     (was: 1378 kB PNG named .webp)
//   3. PNG-only browser        -> image/png   1378 kB   .png     (honest name, at least)
//   4. transparent, no WebP    -> image/png      9 kB   .png     (not JPEG: no black background)
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const servicePath = join(here, '..', 'services', 'productImageStorageService.js');
const source = readFileSync(servicePath, 'utf8');
const shim = join(here, `.productImage.selfcheck.${process.pid}.mjs`);
writeFileSync(shim, `${source.replace(/^import .*?;$/gm, '').replace(/^export /gm, '')}
export { EXTENSION_FOR_TYPE, namedForType };
`);
const { EXTENSION_FOR_TYPE, namedForType } = await import(shim);
unlinkSync(shim);

// The file must be named for what it holds.
for (const [type, extension] of Object.entries({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' })) {
  const named = namedForType(new File([new Uint8Array([1])], 'foto asli.png'), new Blob([new Uint8Array([1])], { type }));
  assert.equal(named.type, type);
  assert.match(named.name, new RegExp(`\\.${extension}$`),
    `a ${type} blob must not be named .${EXTENSION_FOR_TYPE[type] === extension ? 'something else' : extension}`);
}

// An unknown type must not be dressed up as one of ours.
const odd = namedForType(new File([new Uint8Array([1])], 'x.png'), new Blob([new Uint8Array([1])], { type: 'image/gif' }));
assert.doesNotMatch(odd.name, /\.(webp|jpg|png)$/, 'an unexpected encoder output must not claim a format we know');

// The stored object path follows the blob, not a guess.
assert.doesNotMatch(source, /\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 8\)\}\.webp/,
  'the storage path still hardcodes .webp, so a PNG fallback would be stored under a lying name again');
assert.match(source, /EXTENSION_FOR_TYPE\[uploadFile\.type\]/,
  'the storage path must take its extension from the uploaded blob type');

// The encoder ladder: WebP first, PNG last, and JPEG only when there is no alpha to lose.
const ladder = source.slice(source.indexOf("const formats = ["), source.indexOf('for (const format of formats)'));
assert.match(ladder, /'image\/webp'/, 'WebP must still be tried first');
assert.match(ladder, /if \(!hasTransparency\([^)]*\)\) \{\s*\n\s*formats\.push\('image\/jpeg'\)/,
  'JPEG may only be offered for an image with no transparency — it would flatten alpha to black');
assert.ok(ladder.indexOf("'image/png'") > ladder.indexOf("'image/jpeg'"),
  'PNG is the last resort for a photograph, not the second choice');

console.log('productImageFormat selfcheck OK (files are named for what they hold, PNG is the last resort)');
