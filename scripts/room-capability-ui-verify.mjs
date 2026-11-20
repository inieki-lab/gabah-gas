import fs from 'node:fs';
import assert from 'node:assert/strict';

const rooms = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateRoomReservationModal.tsx', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
assert.match(rooms, /const isHumas = currentUser\.role === 'Humas' \|\| currentUser\.role_keys\?\.includes\('humas'\) === true/);
assert.match(rooms, /const isSekdir = currentUser\.role === 'Sekretaris Direksi' \|\| currentUser\.role_keys\?\.includes\('sekretaris_direksi'\) === true/);
assert.match(rooms, /\{isHumas && \(/);
assert.match(rooms, /\{isSekdir && \(/);
assert.match(rooms, /currentUser\.role_label \|\| currentUser\.role/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Humas' \&\&/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Sekretaris Direksi' \&\&/);

assert.match(form, /const isSekdir = currentUser\.role === 'Sekretaris Direksi'[\s\S]*role_keys\?\.includes\('sekretaris_direksi'\)/);
assert.match(form, /currentUser\.permission_keys\.includes\('room_reservations\.override_priority'\)/);
assert.match(form, /File-store compatibility only; PostgreSQL uses explicit capability grants/);
assert.match(form, /if \(isSekdir \|\| meetingType === 'direksi'\)/);
assert.match(form, /!isSekdir/);
assert.match(form, /\[meetingType, meetingTypes, currentUser\.role, isSekdir\]/);
assert.doesNotMatch(form, /currentUser\.role === 'Sekretaris Direksi' \|\| meetingType/);

assert.match(header, /currentUser\.role_keys\?\.includes\('it'\) === true/);
assert.match(header, /currentUser\.role_keys\?\.includes\('ga'\) === true/);
assert.match(header, /const isSuperadmin = currentUser\.is_superadmin === true \|\| currentUser\.role_keys\?\.includes\('superadmin'\) === true/);
assert.doesNotMatch(header, /currentUser\.role === 'IT' \? itFacilityReservations\.length/);
assert.doesNotMatch(header, /currentUser\.role === 'GA' \? gaReservations\.length/);

console.log('Room and meeting additional-role UI contract: passed');
