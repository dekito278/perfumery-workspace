// New bottle photos (Dekito, 26 Nov 2026) are served from the site, public/brand/products/<slug>/, and a manual
// SQL points each product's gallery at them. A file named in the SQL but missing here would be a broken image
// on a live product page the moment Dekito runs it — so every name is checked against the folder.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteSkip } from '../../tools/selfcheckSubject.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS = path.resolve(HERE, '../../public/brand/products');
const SQL = path.resolve(HERE, '../../../../supabase/manual/20261126090000_bottle_photos.sql');

if (!fs.existsSync(SQL) || !fs.readFileSync(SQL, 'utf8').trim()) {
  noteSkip('supabase/manual is outside the build checkout, so bottlePhotosExist runs on a developer machine only');
} else {
  const sql = fs.readFileSync(SQL, 'utf8');
  const rows = [...sql.matchAll(/\('([a-z0-9-]+)',\s*array\[([^\]]+)\]\)/g)];
  assert.ok(rows.length >= 1, 'the photo list in the SQL could not be read');
  for (const [, slug, list] of rows) {
    const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.ok(files.length >= 1, `${slug} has no photos listed`);
    for (const name of files) {
      const file = path.join(PHOTOS, slug, `${name}.webp`);
      assert.ok(fs.existsSync(file), `${slug}/${name}.webp is in the SQL but not in public/brand/products`);
      assert.ok(fs.statSync(file).size < 400 * 1024, `${slug}/${name}.webp is over 400 KB — resize it before it ships`);
      // The two smaller copies the image helpers serve to phones and thumbnails (storageImage.js, 26 Nov 2026).
      for (const width of [240, 600]) {
        assert.ok(fs.existsSync(path.join(PHOTOS, slug, `${name}-${width}.webp`)),
          `${slug}/${name}-${width}.webp is missing — every bottle photo ships with a 240 and a 600 px copy`);
      }
    }
  }
}

console.log('bottlePhotosExist selfcheck OK');
