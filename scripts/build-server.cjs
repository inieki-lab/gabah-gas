const path = require('node:path');
const esbuild = require('esbuild');

esbuild.buildSync({
  entryPoints: [path.resolve(process.cwd(), 'server.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  sourcemap: true,
  outfile: path.resolve(process.cwd(), 'dist/server.cjs'),
});

console.log('[GABAH Build] Express server bundled with PostgreSQL persistence, numbering recovery and API hardening');

