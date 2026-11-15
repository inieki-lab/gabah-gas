import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/views/ReportsView.tsx', 'utf8');
assert.doesNotMatch(source, /96\.8%?|18 Menit|100% Jadwal Akurat|100%|96\.5%|98\.2%|2\.1 Jam|5\.4 Jam|14\.2 Jam/);
assert.match(source, /slaMeasuredTickets = resolvedTickets\.filter/);
assert.match(source, /ticket\.sla_resolution_deadline/);
assert.match(source, /ticket\.resolved_at/);
assert.match(source, /slaOnTimePct === null \? '—'/);
assert.match(source, /timestamp respons pertama belum dicatat/);
assert.match(source, /locationOnlyOwnerValues = new Set\(\['SC', 'SUPPLY CHAIN', 'RPC', 'PIBC'\]\)/);
assert.match(source, /Owner belum diklasifikasikan \/ berisi kode lokasi/);
assert.doesNotMatch(source, /Devisi SC \(Supply Chain|Devisi PIBC \(Pasar Induk/);
assert.match(source, /bukan pembukuan atau perhitungan PSAK 16/);
assert.match(source, /bukan standar akuntansi atau daftar kategori resmi/);
assert.match(source, /filteredMaintenances\.length === 0 \? '—'/);
console.log('Report KPI data integrity: 13 checks passed');
