import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db';
import { GabahDomainService } from '../server/services';
import { AssetNumberingEngine } from '../server/numbering';

seedInitialData();
AssetNumberingEngine._resetForTesting();

const financeActor = {
  id: 'TEST-FINANCE-001',
  name: 'Finance Test User',
  role: 'Karyawan',
  department: 'Finance',
  division: 'Finance',
} as any;

const itTicket = GabahDomainService.createTicket({
  title: 'Finance melaporkan gangguan laptop',
  description: 'Uji tiket lintas departemen Finance ke IT',
  category: 'IT',
  priority: 'medium',
}, financeActor);

assert.equal(itTicket.category, 'IT');
assert.equal(itTicket.reporter_id, financeActor.id);
assert.equal(itTicket.reporter_department, 'Finance');

const gaTicket = GabahDomainService.createTicket({
  title: 'IT melaporkan fasilitas kantor',
  description: 'Uji tiket lintas departemen IT ke GA',
  category: 'GA',
  priority: 'low',
}, { ...financeActor, id: 'TEST-IT-001', department: 'IT' } as any);

assert.equal(gaTicket.category, 'GA');
assert.equal(gaTicket.reporter_department, 'IT');

assert.throws(() => GabahDomainService.createTicket({
  title: 'Kategori tidak dikenal',
  description: 'Harus ditolak',
  category: 'FINANCE',
  priority: 'low',
} as any, financeActor), /Kategori tiket/);

assert.equal(db.tickets.some(ticket => ticket.id === itTicket.id), true);
assert.equal(db.tickets.some(ticket => ticket.id === gaTicket.id), true);

console.log('Cross-department ticket domain verification: PASS (Finance→IT, IT→GA, invalid category rejected)');
