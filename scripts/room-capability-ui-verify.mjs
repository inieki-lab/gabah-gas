import fs from 'node:fs';
import assert from 'node:assert/strict';

const rooms = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateRoomReservationModal.tsx', 'utf8');
assert.match(rooms, /const isHumas = currentUser\.role === 'Humas' \|\| currentUser\.role_keys\?\.includes\('humas'\) === true/);
assert.match(rooms, /const isSekdir = currentUser\.role === 'Sekretaris Direksi' \|\| currentUser\.role_keys\?\.includes\('sekretaris_direksi'\) === true/);
assert.match(rooms, /\{isHumas && \(/);
assert.match(rooms, /\{isSekdir && \(/);
assert.match(rooms, /currentUser\.role_label \|\| currentUser\.role/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Humas' \&\&/);
assert.doesNotMatch(rooms, /currentUser\.role === 'Sekretaris Direksi' \&\&/);

assert.match(form, /const isSekdir = currentUser\.role === 'Sekretaris Direksi'[\s\S]*role_keys\?\.includes\('sekretaris_direksi'\)/);
assert.match(form, /isSekdir \|\| currentUser\.role === 'GA'/);
assert.match(form, /if \(isSekdir \|\| meetingType === 'direksi'\)/);
assert.match(form, /!isSekdir/);
assert.match(form, /\[meetingType, meetingTypes, currentUser\.role, isSekdir\]/);
assert.doesNotMatch(form, /currentUser\.role === 'Sekretaris Direksi' \|\| meetingType/);

console.log('Room and ticket additional-role UI contract: 12 checks passed');
