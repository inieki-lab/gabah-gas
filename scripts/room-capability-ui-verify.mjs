import fs from 'node:fs';
import assert from 'node:assert/strict';

const rooms = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateRoomReservationModal.tsx', 'utf8');
const master = fs.readFileSync('src/components/modals/MeetingMasterSettingsModal.tsx', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
assert.match(rooms, /const hasPermissionMetadata = Array\.isArray\(currentUser\.permission_keys\)/);
assert.match(rooms, /'room_reservations\.documentation\.read'/);
assert.match(rooms, /'room_reservations\.override_priority'/);
assert.match(rooms, /'meeting_facilities\.manage'/);
assert.match(rooms, /const canUpdateMeetingRooms = hasPermission\(/);
assert.match(rooms, /'meeting_rooms\.update'/);
assert.match(rooms, /\{canUpdateMeetingRooms && onUpdateRoomStatus && \(/);
assert.doesNotMatch(rooms, /\{canManageMeetingFacilities && onUpdateRoomStatus && \(/);
assert.match(rooms, /const canManageMeetingTypes = hasPermission\(/);
assert.match(rooms, /const canManageMeetingMasterData = canManageMeetingTypes \|\| canManageMeetingFacilities/);
assert.match(rooms, /\{canManageMeetingMasterData && \(/);

assert.match(master, /const canManageTypes = hasPermission\('meeting_types\.manage'/);
assert.match(master, /const canManageFacilities = hasPermission\('meeting_facilities\.manage'/);
assert.match(master, /canReadTypes \? gabahApi\.getMeetingTypes\(\) : Promise\.resolve\(\[\]\)/);
assert.match(master, /canReadFacilities \? gabahApi\.getMeetingFacilities\(\) : Promise\.resolve\(\[\]\)/);
assert.match(master, /if \(!canManageTypes\) \{/);
assert.match(master, /if \(!canManageFacilities\) \{/);
assert.match(master, /\{canManageTypes && \(/);
assert.match(master, /\{canManageFacilities && \(/);
const meetingTypesBlock = services.slice(services.indexOf('// Meeting Types CRUD'), services.indexOf('// Meeting Facilities CRUD'));
assert.equal((meetingTypesBlock.match(/hasRoomPermission\(actor, 'meeting_types\.manage', \['GA'\]\)/g) || []).length, 3);
assert.match(rooms, /'room_reservations\.approve'/);
assert.match(rooms, /'room_reservations\.reject'/);
assert.match(rooms, /'room_reservations\.checkin'/);
assert.match(rooms, /'room_reservations\.checkout'/);
assert.match(rooms, /'room_reservations\.cancel'/);
assert.match(rooms, /'room_reservations\.create'/);
assert.match(rooms, /const isReadOnly = GabahService.isReadOnly(currentUser)/);
assert.match(rooms, /const hasPermission = \(permission: string, legacyFallback = false\) =>\s*!isReadOnly &&/);
assert.match(rooms, /\{isHumas && \(/);
assert.match(rooms, /\{isSekdir && \(/);
assert.match(rooms, /\{canManageMeetingFacilities &&/);
assert.match(rooms, /\{canCreateReservations &&/);
assert.match(rooms, /canApproveReservations &&/);
assert.match(rooms, /canRejectReservations &&/);
assert.match(rooms, /canCheckinReservations && r\.status === 'approved'/);
assert.match(rooms, /canCheckoutReservations && r\.status === 'in_use'/);
assert.match(rooms, /currentUser\.role_label \|\| currentUser\.role/);
assert.doesNotMatch(rooms, /isGAOrAdmin/);
assert.doesNotMatch(rooms, /&& !isReadOnly &&/);

assert.match(form, /const isSekdir = currentUser\.role === 'Sekretaris Direksi'[\s\S]*role_keys\?\.includes\('sekretaris_direksi'\)/);
assert.match(form, /const isReadOnly = GabahService.isReadOnly(currentUser)/);
assert.match(form, /const canCreateReservation = !isReadOnly && \(isSuperAdmin \|\| \(hasPermissionMetadata/);
assert.match(form, /if \(isReadOnly\) return false;/);
assert.match(form, /currentUser\.permission_keys!\.includes\('room_reservations\.create'\)/);
assert.match(form, /if \(!canCreateReservation\) \{/);
assert.match(form, /disabled=\{!canCreateReservation \|\| isSubmitting/);
assert.match(form, /currentUser\.permission_keys\.includes\('room_reservations\.override_priority'\)/);
assert.match(form, /File-store compatibility only; PostgreSQL uses explicit capability grants/);
assert.match(form, /if \(isSekdir \|\| meetingType === 'direksi'\)/);
assert.match(form, /!isSekdir/);
assert.match(form, /\[meetingType, meetingTypes, currentUser\.role, isSekdir\]/);
assert.doesNotMatch(form, /currentUser\.role === 'Sekretaris Direksi' \|\| meetingType/);

assert.match(header, /room_reservations\.it_facilities\.read/);
assert.match(header, /room_reservations\.approve/);
assert.match(header, /room_reservations\.documentation\.read/);
assert.match(header, /Array\.isArray\(currentUser\.permission_keys\)/);
assert.match(header, /const isSuperadmin = currentUser\.is_superadmin === true \|\| currentUser\.role_keys\?\.includes\('superadmin'\) === true/);
assert.doesNotMatch(header, /currentUser\.role === 'IT' \? itFacilityReservations\.length/);
assert.doesNotMatch(header, /currentUser\.role === 'GA' \? gaReservations\.length/);

console.log('Room and meeting additional-role UI contract: passed');


// Sidebar queue badges and contextual labels must use effective capability grants.
const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
assert.match(sidebar, /const hasPermissionMetadata = Array\.isArray\(currentUserPermissions\)/);
assert.match(sidebar, /hasPermission\('room_reservations\.documentation\.read', \['Humas'\]\)/);
assert.match(sidebar, /hasPermission\('room_reservations\.override_priority', \['Sekretaris Direksi'\]\)/);
assert.match(sidebar, /hasPermission\('room_reservations\.it_facilities\.read', \['IT', 'Admin GABAH'\]\)/);
assert.match(sidebar, /hasPermission\('room_reservations\.approve'/);
assert.match(sidebar, /hasPermission\('room_reservations\.reject'/);
assert.match(sidebar, /isIT && itFacilitiesCount > 0/);
assert.match(sidebar, /isGA && \(gaRequestsCount > 0 \|\| pendingReservationsCount > 0\)/);
assert.doesNotMatch(sidebar, /activeRole === 'IT' && itFacilitiesCount/);
assert.doesNotMatch(sidebar, /activeRole === 'GA' \|\| activeRole === 'Admin GABAH'/);
console.log('Sidebar dynamic queue capability contract: passed');


const reservationStart = services.indexOf('static async requestRoomReservation(');
const reservationEnd = services.indexOf('static async approveRoomReservation(', reservationStart);
assert.ok(reservationStart >= 0 && reservationEnd > reservationStart, 'room reservation service must exist');
const reservationService = services.slice(reservationStart, reservationEnd);
assert.match(reservationService, /payload\.meeting_type[\s\S]*Array\.from\(payload\.meeting_type\.trim\(\)\)\.length > 50/);
assert.ok(reservationService.includes("rawFacilities.some(item => typeof item !== 'string' || !item.trim() || item.includes('\\u0000')"));
assert.ok(reservationService.includes("value.includes('\\u0000') || Array.from(value).length > maxLength"));


const meetingRoomsUi = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');
assert.ok(meetingRoomsUi.includes("GabahService.hasLegacyCapability(currentUser, 'ga')"), 'GA room queue/actions must honor secondary GA capability in file-store mode');
