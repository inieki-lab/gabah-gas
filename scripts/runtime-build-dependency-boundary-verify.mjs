import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /^import\s+\{\s*createServer\s+as\s+createViteServer\s*\}\s+from\s+['"]vite['"];?$/m,
  'Vite must not be statically imported by the production server entrypoint');
const devBlock = source.indexOf("if (process.env.NODE_ENV !== 'production')");
const dynamicImport = source.indexOf("await import('vite')", devBlock);
const productionBlock = source.indexOf("} else {", devBlock);
assert.ok(devBlock >= 0 && dynamicImport > devBlock && productionBlock > dynamicImport,
  'Vite must be loaded dynamically inside the non-production branch only');
assert.match(source.slice(devBlock, productionBlock), /await import\(['"]vite['"]\)/,
  'development server must still load Vite middleware');
console.log('PASS: production server does not eagerly require the Vite development tool.');
