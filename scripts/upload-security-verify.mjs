import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createUploadConcurrencyLimiter } from '../server/upload-security.ts';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const limiter = createUploadConcurrencyLimiter(2, 7);

function request() {
  return new EventEmitter();
}
function response() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.payload = undefined;
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (payload) => { res.payload = payload; return res; };
  return res;
}
function invoke(req, res) {
  let continued = false;
  limiter(req, res, () => { continued = true; });
  return continued;
}

const req1 = request(), res1 = response();
const req2 = request(), res2 = response();
assert.equal(invoke(req1, res1), true);
assert.equal(invoke(req2, res2), true);

const req3 = request(), res3 = response();
assert.equal(invoke(req3, res3), false);
assert.equal(res3.statusCode, 503);
assert.equal(res3.headers['retry-after'], '7');
assert.equal(res3.payload.retry_after_seconds, 7);

// Finish releases exactly one slot; a subsequent close must not release twice.
res1.emit('finish');
const req4 = request(), res4 = response();
assert.equal(invoke(req4, res4), true);
res1.emit('close');
const req5 = request(), res5 = response();
assert.equal(invoke(req5, res5), false, 'finish + close must release only one slot');

// Aborted requests also release; the later response close remains idempotent.
req2.emit('aborted');
const req6 = request(), res6 = response();
assert.equal(invoke(req6, res6), true);
res2.emit('close');
const req7 = request(), res7 = response();
assert.equal(invoke(req7, res7), false, 'aborted + close must release only one slot');

res4.emit('close');
assert.equal(invoke(request(), response()), true, 'response close must release a slot');
res6.emit('finish');

assert.match(source, /fileSize: 10 \* 1024 \* 1024/);
assert.match(source, /files: 1/);
assert.match(source, /fields: 10/);
assert.match(source, /parts: 11/);
assert.match(source, /fieldNameSize: 100/);
assert.match(source, /fieldSize: 64 \* 1024/);
assert.match(source, /headerPairs: 100/);
assert.match(source, /authorizeContractDocumentUpload, limitContractUploadConcurrency, upload\.single\('file'\)/);

console.log('PASS | concurrent memory-backed contract uploads are capped at two');
console.log('PASS | finish, close, and aborted paths release capacity exactly once');
console.log('PASS | multipart files, fields, parts, names, field bytes, and headers are bounded');
