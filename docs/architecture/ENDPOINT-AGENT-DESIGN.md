# GABAH Endpoint Agent — Proposed Technical Design

**Status:** Proposal only — not implemented  
**Scope:** Windows and Linux endpoint inventory collection  
**Target:** GABAH asset-management module  
**Decision owner:** IT / application owner  
**Date:** 12 November 2026

## 1. Objective

Provide a lightweight endpoint agent, comparable in purpose to GLPI Agent, that periodically collects approved hardware, operating-system, network-adapter, and installed-software inventory from company-managed Windows and Linux computers and submits it to GABAH over outbound HTTPS.

The agent is an inventory collector only. It is not a remote-management, monitoring, EDR, patching, or remote-shell product.

## 2. Recommended implementation

- **Agent language:** Go, compiled as a standalone executable for Windows and Linux. This avoids requiring Node.js, Python, or a JVM on managed endpoints.
- **Windows runtime:** Windows Service, installed and managed by IT.
- **Linux runtime:** systemd service and timer (or a single long-running service with an internal scheduler).
- **Server:** Existing Node.js/Express API and PostgreSQL. Agent ingestion must use a dedicated device-authentication path, not employee session authentication and not the normal `/api/assets` employee CRUD endpoints.
- **Transport:** TLS 1.2+ HTTPS, outbound only. No inbound listener or firewall port is required on client computers.

## 3. Collection policy

### Initial MVP inventory

| Group | Fields |
|---|---|
| Device identity | Agent-generated stable device UUID, hostname, manufacturer, model, serial number, system UUID |
| Processor | CPU vendor/model, physical/logical core counts |
| Memory | Total RAM; per-slot details only where reliably available |
| Storage | Physical disk model, capacity, media type where detectable |
| Operating system | Family, edition/distribution, version, build, architecture, install/kernel version |
| Network | Adapter name/type, MAC address, assigned private IPv4/IPv6 addresses |
| Software | Installed application name, version, publisher, package source where available |
| Agent | Agent version, last scan time, last successful contact, collection status |

Fields that are unavailable or require elevated privileges must be represented as unavailable, not fabricated. Do not collect usernames, home-directory contents, browser history, documents, passwords, Wi-Fi secrets, private keys, or unrelated personal data.

### Schedule

- Full inventory at installation/enrollment.
- Full inventory every 24 hours by default.
- Small heartbeat every 15 minutes, configurable centrally.
- Optional on-demand inventory request in a later phase; the request may trigger inventory collection only, never arbitrary command execution.
- Randomized schedule jitter to avoid synchronized bursts.

### Offline behavior

Keep only a bounded, protected local queue of the latest inventory snapshot and retry with exponential backoff. Do not retain an unbounded history on the endpoint. Protect local credentials and queued data with OS-native permissions/credential storage where available.

## 4. Enrollment and authentication

1. An authorized GABAH administrator creates a one-time, short-lived enrollment code for a device or deployment batch.
2. The agent exchanges the code over HTTPS and receives a unique device identity and credential.
3. Store only a hash of the device credential server-side. Show the secret only once during enrollment.
4. Scope the credential to inventory submission and heartbeat for that one device. It must not authenticate as an employee or grant asset CRUD, user administration, or general API access.
5. Support credential rotation, revocation, expiry, and audit events.
6. Protect ingestion against replay using timestamp/nonce validation and request-size limits. Rate-limit per device and globally.
7. Do not put a shared fleet-wide API key in an installer or configuration file.

mTLS can be evaluated for managed environments with certificate lifecycle automation. Per-device credentials over TLS are the simpler initial deployment path, provided rotation and revocation are implemented.

## 5. Server-side data model

Keep endpoint observations separate from the authoritative corporate asset register.

Proposed entities (exact DDL to follow after schema review):

- `endpoint_agents`: device UUID, credential hash, status, enrolled_at, last_seen_at, revoked_at, agent version, policy reference.
- `endpoint_inventory_snapshots`: agent/device ID, collected_at, received_at, schema_version, normalized inventory payload, payload hash.
- `endpoint_inventory_software`: snapshot ID, software name/version/publisher/source, if normalized relational querying is required.
- `endpoint_asset_links`: endpoint/device ID to GABAH asset ID, link status, matching evidence, reviewed_by, reviewed_at.

Use unique constraints for device UUID and suitable deduplication keys. Keep inventory snapshots append-only or versioned; do not silently overwrite the previous observation. Define retention and purge policy before production.

## 6. Reconciliation with the asset register

An endpoint observation is not automatically a new corporate asset.

Suggested matching order:
1. Exact serial number, when present and trustworthy.
2. Exact system UUID, when present and trustworthy.
3. Existing approved device-to-asset link.
4. Hostname/MAC as supporting evidence only; these can change or be reused.

The server should show three states: matched, unmatched, and possible duplicate/conflict. IT reviews and links observations to existing assets. New corporate asset creation, ownership, acquisition value, custodian, physical location, warranty, and asset numbering remain governed by existing GABAH workflows and authorized staff.

Agent-collected hostname/IP/MAC may populate a dedicated observed-inventory view. They must not silently overwrite manually verified asset fields or alter owner domain, asset number, assigned employee, managing unit, or physical location.

## 7. Authorization and visibility

- Agent credentials are machine identities, not user roles.
- Agent endpoints accept only the minimum inventory permissions.
- IT/Admin users may view fleet inventory according to explicit GABAH permission and data scope.
- GA read-only workstation visibility, if required, must use the existing explicit permission model and must not imply maintenance or mutation rights.
- Auditor access is read-only and scoped by explicit permission.
- Ordinary employees must not be able to enumerate all enrolled devices.
- Every enrollment, credential rotation/revocation, inventory submission failure, manual asset link, and unlink action must be auditable.
- Never trust owner division, employee identity, department, or asset assignment values supplied by the agent.

## 8. API outline (proposal)

- `POST /api/agent/enroll` — exchange a one-time enrollment code.
- `POST /api/agent/heartbeat` — device liveness and agent version.
- `POST /api/agent/inventory` — submit a versioned inventory snapshot.
- `POST /api/agent/credential/rotate` — rotate the device's own credential under a narrowly scoped protocol.
- Admin-only GABAH routes for enrollment-code issuance, device revocation, policy configuration, inventory review, and asset linking.

These routes require dedicated machine-auth middleware, strict schema validation, bounded payload size, rate limits, idempotency, replay protection, and audit logging. They must not reuse `getActor()` as if an agent were a human user.

## 9. Deployment and operations

- Sign Windows installer and agent binaries; publish checksums and versioned releases.
- Linux packages should use signed repository metadata or signed release artifacts.
- Agent updates must verify publisher signatures and must not accept arbitrary executable URLs from the server.
- Provide uninstall and credential revocation procedures.
- Start with a pilot group of IT-managed Windows devices and one supported Linux distribution.
- Monitor enrolled/active devices, stale heartbeat, last inventory time, agent version, failed submissions, and unmatched inventory.
- Support proxy configuration if company network egress requires it.

## 10. Delivery phases

1. **Contract and schema:** finalize fields, privacy policy, API contract, device identity, credential lifecycle, RBAC permissions, and retention.
2. **MVP agent:** Windows + one Linux distribution, inventory scan, heartbeat, retry queue, secure enrollment.
3. **Server ingestion:** migrations, dedicated machine auth, validation, rate limiting, audit, idempotency.
4. **Inventory review UI:** device list, detail, stale/offline state, differences, duplicate detection, manual asset linking.
5. **Pilot and hardening:** signed packages, upgrades, revocation drills, load tests, Windows/Linux compatibility matrix, backup/restore and UAT.
6. **Broader rollout:** staged deployment by location and asset owner after IT and business-owner sign-off.

## 11. Acceptance criteria

- A device cannot submit inventory for another device by changing a request field.
- Revoked, expired, malformed, replayed, or oversized requests are rejected.
- Agent credentials cannot call employee, asset CRUD, user, RBAC, or administrative APIs.
- Duplicate submissions are idempotent and do not create duplicate devices or corporate assets.
- Missing hardware fields remain unknown; no invented values are stored.
- A hostname/IP/MAC change creates an observation update, not a new corporate asset.
- Agent cannot change asset ownership, number, employee assignment, unit, or physical location.
- Offline collection recovers without losing the latest snapshot or growing disk usage without bound.
- Windows Service and Linux systemd lifecycle, upgrade, uninstall, and revocation are verified.
- Collection and visibility are tested with IT, GA, Auditor, and ordinary employee personas.

## 12. Explicit non-goals and security boundary

The first release must not implement remote shell, arbitrary PowerShell/Bash execution, remote desktop, file browsing, software deployment/uninstallation, keylogging, screen capture, user activity monitoring, or security-product replacement. Those capabilities require separate threat modelling, authorization, approval, and product scope.

## 13. Current implementation status

No agent binary, installer, database migration, API route, or UI has been implemented by this proposal. Existing `/api/assets` routes use employee Dynamic RBAC and are not suitable as a machine-ingestion endpoint. Implementation must start with the dedicated device identity/authentication and data model, not by giving the agent an employee token or reusing asset CRUD.
