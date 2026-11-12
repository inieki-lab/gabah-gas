import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const uploadStart = source.indexOf('const upload = multer({');
const uploadEnd = source.indexOf('const hasValidContractDocumentSignature', uploadStart);
const uploadConfig = uploadStart >= 0 && uploadEnd > uploadStart ? source.slice(uploadStart, uploadEnd) : '';
const downloadStart = source.indexOf("app.get('/api/contracts/:id/documents/:documentId/download'");
const downloadEnd = source.indexOf('// Legacy endpoint', downloadStart);
const downloadRoute = downloadStart >= 0 && downloadEnd > downloadStart ? source.slice(downloadStart, downloadEnd) : '';

const checks = [
  ['uploads use memory storage before validation', /storage: multer\.memoryStorage\(\)/.test(uploadConfig)],
  ['upload file size is capped at 10 MiB', /fileSize: 10 \* 1024 \* 1024/.test(uploadConfig)],
  ['multipart file, field, and part counts are bounded', /files: 1/.test(uploadConfig) && /fields: 20/.test(uploadConfig) && /parts: 25/.test(uploadConfig)],
  ['multipart field names and values are bounded', /fieldNameSize: 100/.test(uploadConfig) && /fieldSize: 16 \* 1024/.test(uploadConfig)],
  ['file extension and MIME allowlist is enforced', /mimeByExtension/.test(uploadConfig) && /mimeByExtension\[ext\] !== file\.mimetype/.test(uploadConfig)],
  ['uploaded file signatures are checked', /hasValidContractDocumentSignature\(file\)/.test(source)],
  ['stored filenames are generated server-side', /crypto\.randomUUID\(\) \+ fileExt/.test(source)],
  ['download requires contracts.read and record visibility', /requireRbacPermission\(req, res, 'contracts\.read'\)/.test(downloadRoute) && /canSeeContract\(actor, contract\)/.test(downloadRoute)],
  ['download path is confined to the contract storage directory', /absoluteFilePath\.startsWith\(contractRoot\)/.test(downloadRoute)],
  ['uploads are not exposed as a public static directory', !/express\.static\([^)]*uploadRoot/.test(source) && !/express\.static\([^)]*uploads/.test(source)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Upload security contract failed.');
