import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server/contracts.ts', import.meta.url), 'utf8');
const checks = [
  ['Renewal outcome is runtime-validated against the declared enum', /const allowedOutcomes: RenewalOutcome\[\] = \[[\s\S]*?'pending_decision'[\s\S]*?'replaced_by_new_contract'[\s\S]*?\];[\s\S]*?if \(!allowedOutcomes\.includes\(outcome\)\)/.test(source)],
  ['Replacement decision requires a replacement contract ID', /if \(outcome === 'replaced_by_new_contract'\) \{[\s\S]*?if \(!replacementContractId\)/.test(source)],
  ['Replacement contract must exist', /const replacement = db\.contracts\.find\(item => item\.id === replacementContractId\);[\s\S]*?if \(!replacement\)/.test(source)],
  ['A contract cannot replace itself', /replacement\.id === contract\.id/.test(source)],
  ['Replacement contract must also be visible to the acting user', /canSeeContract\(actor, replacement\)/.test(source)],
  ['Replacement contract must have the same normalized owner division', /sourceOwner[\s\S]*replacementOwner[\s\S]*replacementOwner !== sourceOwner/.test(source)],
  ['Replacement ID is rejected for other renewal outcomes', /\} else if \(replacementContractId\) \{[\s\S]*ID kontrak pengganti hanya boleh diisi/.test(source)],
  ['Contract creation validates strict calendar dates and date order', /validDate\\(startDate\\)[\\s\\S]*?validDate\\(endDate\\)[\\s\\S]*?endDate < startDate/.test(source)],
  ['Contract creation rejects missing or inactive PIC instead of silently substituting actor', /const pic = db\\.users\\.find[\\s\\S]*?if \\(!pic \\|\\| !pic\\.is_active\\)/.test(source)],
  ['Contract creation rejects orphan parent contract references', /parentContractId && !parentContract/.test(source)],
  ['Contract parent must belong to the same owner division', /parentContract[\\s\\S]*?parentContract\\.owner_division[\\s\\S]*?ownerDivision/.test(source)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
