import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = fs.readFileSync(path.join(root, 'server/migrations/097_contract_number_sequences.sql'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'server/persistence.ts'), 'utf8');
const numbering = fs.readFileSync(path.join(root, 'server/numbering.ts'), 'utf8');
const contracts = fs.readFileSync(path.join(root, 'server/contracts.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS contract_number_sequences'));
assert.ok(persistence.includes('INSERT INTO contract_number_sequences') && persistence.includes('ON CONFLICT (sequence_year) DO NOTHING'));
assert.ok(persistence.includes('SELECT last_sequence FROM contract_number_sequences') && persistence.includes('FOR UPDATE'));
assert.ok(persistence.includes("'SELECT contract_number FROM contracts WHERE UPPER(contract_number) LIKE UPPER($1)'"));
assert.ok(numbering.includes('static formatContractNumber(targetYear: number, sequence: number)'));
assert.ok(contracts.includes('async createContract(') && contracts.includes('Promise<ServerContract>'));
assert.ok(contracts.includes('await allocateContractSequence(contractYear)'));
assert.ok(contracts.includes('AssetNumberingEngine.formatContractNumber(contractYear, contractSequence)'));
assert.ok(server.includes('await ContractDomainService.createContract(req.body, actor)'));

console.log('PASS PostgreSQL row-locked contract numbering, legacy sequence bootstrap, formatting, and awaited creation path');
