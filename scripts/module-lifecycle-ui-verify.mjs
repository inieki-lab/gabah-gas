import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
const admin = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const panel = fs.readFileSync('src/components/modals/ModuleLifecyclePanel.tsx', 'utf8');

const checks = [
  ['Typed module list API exists', /getModules\(\): Promise<ModuleLifecycleRecord\[\]>/.test(api)],
  ['Typed module update API exists', /updateModuleStatus\(moduleKey: string/.test(api)],
  ['Typed module audit API exists', /getModuleAudit\(moduleKey: string/.test(api)],
  ['App loads module availability for authenticated users', /gabahApi\.getModules\(\)/.test(app)],
  ['App falls back when current module becomes inactive', /activeModuleKeys\.find\(key => isNavTabAllowedForRole/.test(app)],
  ['App passes module status to Sidebar', /activeModuleKeys=\{activeModuleKeys\}/.test(app)],
  ['App refreshes menu after module changes', /onModulesChanged=\{refreshModuleStatuses\}/.test(app)],
  ['Sidebar hides inactive navigation modules', /activeModuleKeys === undefined \|\| activeModuleKeys\.includes\(item\.id\)/.test(sidebar)],
  ['Sidebar recognizes additional Humas and Sekdir capabilities', /currentUserRoleKeys\?\.includes\('humas'\)/.test(sidebar) && /currentUserRoleKeys\?\.includes\('sekretaris_direksi'\)/.test(sidebar)],
  ['Administration exposes a module lifecycle section', /id: 'modules' as AdminSection/.test(admin) && /activeSection === 'modules'/.test(admin)],
  ['Module panel requires a reason and updates status', /reason\.trim\(\)\.length < 5/.test(panel) && /gabahApi\.updateModuleStatus/.test(panel)],
  ['Module panel displays append-only audit history', /gabahApi\.getModuleAudit/.test(panel) && /row\.previous_is_active/.test(panel)],
  ['Module panel refreshes navigation after successful change', /await onChanged\?\.\(\)/.test(panel)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
