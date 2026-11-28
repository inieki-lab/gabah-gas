import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const start = api.indexOf('async getModules(): Promise<ModuleLifecycleRecord[]>');
const end = api.indexOf('async updateModuleStatus(', start);
assert.ok(start >= 0 && end > start, 'getModules must exist');
const method = api.slice(start, end);

assert.match(method, /new AbortController\(\)/,
  'module status request must have an abort controller');
assert.match(method, /setTimeout\(\(\) => controller\.abort\(\),\s*12_000\)/,
  'module status request must have a finite 12-second timeout');
assert.match(method, /this\.request<ModuleLifecycleRecord\[]>\('\/api\/modules',\s*\{\s*signal:\s*controller\.signal/s,
  'timeout signal must be passed to the actual modules API request');
assert.match(method, /if \(controller\.signal\.aborted\)/,
  'timeout must be distinguishable from ordinary API errors');
assert.match(method, /Waktu tunggu pemuatan status modul habis/,
  'timeout must produce an actionable Indonesian error');
assert.match(method, /finally\s*\{\s*clearTimeout\(timeoutId\);\s*\}/,
  'timeout timer must always be cleaned up');

const refreshStart = app.indexOf('const refreshModuleStatuses');
const refreshEnd = app.indexOf('useEffect(() => {', refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'module refresh handler must exist');
const refresh = app.slice(refreshStart, refreshEnd);
assert.match(refresh, /catch\s*\{[\s\S]*setActiveModuleKeys\(null\)[\s\S]*setModuleStatusLoadFailed\(true\)/,
  'module timeout/failure must fail closed and expose the retry state');

assert.match(app, /Status modul tidak dapat diverifikasi/,
  'module failure must show a visible status instead of a permanent loading state');
assert.match(app, /void refreshModuleStatuses\(\)/,
  'the visible retry control must invoke module status refresh');

console.log('Module status timeout regression: PASS (stalled requests fail closed and expose retry).');
