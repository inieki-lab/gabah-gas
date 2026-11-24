# GABAH PostgreSQL Atomic Contract Numbering Worklog — 2026-11-24

## Risk found
Contract numbers `CTR-YYYY-NNNN` were generated from a process-local `Map`. Startup reconciliation prevented a simple restart reset, but two PostgreSQL-backed app instances could still allocate the same next number concurrently. The contracts table's unique constraint would reject one request rather than provide safe allocation.

## Implementation
- Migration `104_contract_number_sequences.sql` adds one durable yearly counter per `sequence_year`.
- Startup reconciliation derives the maximum existing `CTR-YYYY-NNNN` suffix from normalized `contracts` and UPSERTs with `GREATEST`.
- `reserveContractNumberSequence()` reserves the next value in a PostgreSQL transaction using `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
- `ContractDomainService.createContract()` is async and uses the durable counter in PostgreSQL mode; file-store development retains the in-memory fallback.
- PostgreSQL runtime failure is fail-closed; the service never falls back to a local counter after the failure latch.
- Contract IDs now use cryptographic UUIDs rather than millisecond timestamps, avoiding a second cross-process collision vector.
- API route awaits contract creation. Contract validation regression now awaits async rejections.

## Integration tests
- Two independent GABAH processes create contracts concurrently against the same PostgreSQL database; both numbers and rows must be distinct and the shared counter must increment twice.
- After the primary app restarts, a new contract must increment the durable counter exactly once.
- Static contract-domain regression asserts the migration, allocator, fail-closed guard, formatter, and awaited API call.

## Semantics
- Number format remains `CTR-YYYY-NNNN`; no existing contract numbers are rewritten.
- A gap is allowed if reservation commits but later contract persistence fails. A reserved number is never reused.
- Sequence counter is yearly; existing company numbering format decisions are not changed.

## Verification
- PR #261: https://github.com/inieki-lab/gabah-gas/pull/261
- CI pending.
