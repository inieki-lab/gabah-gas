import assert from 'node:assert/strict';
import { matchesAssetCategoryFilter } from '../src/utils/assetCategoryFilter';

const cases: [string, Record<string, string>, string, boolean][] = [
  ['MacBook HLT tidak masuk INV-P', { name: 'MacBook Pro 14', category_code: 'HLT', asset_number: 'IT-HLT-2026-0001' }, 'INV-P', false],
  ['MacBook dengan AC Adapter tetap bukan INV-P', { name: 'MacBook Pro dengan AC Adapter', category_code: 'HLT' }, 'INV-P', false],
  ['MacBook masuk IT-H', { name: 'MacBook Pro 14', category_code: 'HLT' }, 'IT-H', true],
  ['AC split masuk INV-P', { name: 'AC Split Inverter 2 PK', category_code: 'INV-P' }, 'INV-P', true],
  ['AC token legacy masuk INV-P', { name: 'AC Split Kantor' }, 'INV-P', true],
  ['MacBook legacy tidak salah terbaca sebagai AC', { name: 'MacBook Air' }, 'INV-P', false],
  ['Dispenser masuk INV-P', { name: 'Dispenser Galon Bawah', category_code: 'INV-P' }, 'INV-P', true],
  ['Kursi masuk INV-F', { name: 'Kursi Ergonomis', category_code: 'INV-F' }, 'INV-F', true],
  ['Nomor aset IT-HLT menjadi acuan', { name: 'Laptop', asset_number: 'IT-HLT-2026-0001' }, 'IT-H', true],
  ['Nomor aset legacy -IT-H- tetap dikenali', { name: 'Laptop', asset_number: 'ASSET-IT-H-2024-0001' }, 'IT-H', true],
  ['Nomor aset legacy -IT-S- tetap dikenali', { name: 'Lisensi ERP', asset_number: 'ASSET-IT-S-2024-0001' }, 'IT-S', true],
  ['Nomor aset GA-INV-P menjadi acuan', { name: 'Peralatan pantry', asset_number: 'GA-INV-P-2026-0001' }, 'INV-P', true],
  ['Kode kategori kanonikal mengalahkan nama ambigu', { name: 'ACME MacBook', category_code: 'HLT' }, 'INV-P', false],
];

for (const [label, asset, category, expected] of cases) {
  assert.equal(matchesAssetCategoryFilter(asset, category), expected, label);
  console.log('PASS', label);
}
console.log('\n13 asset category filter checks passed.');
