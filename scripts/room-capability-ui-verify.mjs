import fs from 'node:fs';
import assert from 'node:assert/strict';

const rooms = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateRoomReservationModal.tsx', 'utf8');

// PostgreSQL mode resolves function capabilities from assigned role keys;
// legacy profile labels are consulted only when role_keys are unavailable.
assert.match(rooms, /const hasRoleKey = \(key: string, legacyLabel: string\) =>[\s\S]*currentUser\.role_keys !== undefined[\s\S]*currentUser\.role_keys\.includes\(key\)[\s\S]*currentUser\.role === legacyLabel/);
assert.match(rooms, /const isHumas = hasRoleKey\('humas', 'Humas'\)/);
assert.match(rooms, /const isSekdir = currentUser\.is_superadmin === true \|\| currentUser\.permission_keys\?\.includes\('room_reservations\.override_priority'\) === true \|\| \(currentUser\.permission_keys === undefined && currentUser\.role === 'Sekretaris Direksi'\)/);
assert.match(rooms, /\{isHumas && \(/);
assert.match(rooms, /\{isSekdir && \(/);
assert.match(rooms, /currentUser\.role_label \|\| currentUser\.role/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Humas' &&/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Sekretaris Direksi' &&/);

// Override UI is permission-first in PostgreSQL and keeps a narrow file-store fallback.
assert.match(form, /const isAuditor = currentUser\.role_keys\?\.includes\('auditor'\) === true \|\| currentUser\.role === 'Auditor'/);
assert.match(form, /const canOverride = useMemo\(\(\) => !isAuditor && \([\s\S]*currentUser\.is_superadmin === true[\s\S]*currentUser\.permission_keys\?\.includes\('\*'\) === true[\s\S]*currentUser\.permission_keys\?\.includes\('room_reservations\.override_priority'\) === true[\s\S]*currentUser\.permission_keys === undefined && currentUser\.role === 'Sekretaris Direksi'/);
assert.match(form, /const isSekdir = canOverride/);
assert.match(form, /if \(isSekdir \|\| meetingType === 'direksi'\)/);
assert.match(form, /!isSekdir/);
assert.match(form, /\[meetingType, meetingTypes, currentUser\.role, isSekdir\]/);
assert.doesNotMatch(form, /currentUser\.role === 'Sekretaris Direksi' \|\| meetingType/);

console.log('Room and meeting additional-role UI contract: 13 checks passed');
