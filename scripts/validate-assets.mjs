import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'default-artworks/manifest.json'), 'utf8'));
for (const artwork of manifest.artworks) {
  if (!artwork.imageSrc.startsWith('/')) continue;
  const relative = decodeURIComponent(artwork.imageSrc).replace(/^\/+/, '');
  // Compare exact spelling as Vercel serves on a case-sensitive filesystem.
  let current = publicDir;
  for (const part of relative.split('/')) {
    if (part === '..' || !fs.existsSync(current) || !fs.readdirSync(current).includes(part)) {
      throw new Error(`Missing artwork asset: ${artwork.imageSrc}`);
    }
    current = path.join(current, part);
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Artwork is not a file: ${artwork.imageSrc}`);
}
console.log(`Verified ${manifest.artworks.length} artwork assets.`);
