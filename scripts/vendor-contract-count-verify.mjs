import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf("  // Vendor Directory (server-authoritative)");
const end = source.indexOf("  // Knowledge Base (SOP & panduan operasional)", start);
assert.ok(start >= 0 && end > start, 'vendor routes must exist');
const routes = source.slice(start, end);
assert.match(routes, /const getActiveVendorContractCount = \(vendorName: string\): number/);
assert.match(routes, /\['active', 'expiring', 'renewal_in_progress'\]/);
assert.match(routes, /active_contracts_count: getActiveVendorContractCount\(v\.name\)/);
assert.match(routes, /active_contracts_count: getActiveVendorContractCount\(name\)/);
assert.doesNotMatch(routes, /active_contracts_count: Number\(req\.body\.active_contracts_count\)/);
assert.doesNotMatch(routes, /'address', 'active_contracts_count', 'rating'/);
assert.match(routes, /vendor\.active_contracts_count = getActiveVendorContractCount\(vendor\.name\)/);
console.log('Vendor contract count authority: 7 checks passed');

assert.ok(routes.includes("name.includes('\\u0000')"), 'vendor create rejects NUL in name');
assert.ok(routes.includes("requestedCategory.includes('\\u0000')"), 'vendor create/update reject NUL in category');
assert.ok(routes.includes("value.includes('\\u0000')"), 'vendor create/update reject NUL in PIC and address text');
assert.ok(routes.includes("Array.from(value).length > maxLength"), 'vendor text fields are bounded by storage limits');
