import React from 'react';
import { 
  Package, 
  Laptop, 
  Car, 
  KeyRound, 
  CalendarClock, 
  LifeBuoy, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  Plus, 
  ShieldCheck,
  Clock,
  ExternalLink,
  BookOpen,
  UserCheck,
  Building2,
  Camera,
  LayoutDashboard,
  BarChart3
} from 'lucide-react';
import { Asset, Loan, Ticket, UserProfile, UserRole, AuditLog, RoomReservation } from '../../types';
import { GabahService, formatRupiah, formatDateTime, formatDate } from '../../services/gabahService';
import { NavTab } from '../Sidebar';
import { isExactIdentityNameMatch } from '../../utils/identityMatching';
import { isEmployeeFacingDashboardRole } from '../../dashboard/dashboardAudience';

interface DashboardViewProps {
  assets: Asset[];
  loans: Loan[];
  tickets: Ticket[];
  currentUser: UserProfile;
  auditLogs: AuditLog[];
  roomReservations?: RoomReservation[];
  onNavigate: (tab: NavTab) => void;
  onOpenNewLoanModal: () => void;
  onOpenNewTicketModal: () => void;
  onOpenNewAssetModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  assets = [],
  loans = [],
  tickets = [],
  currentUser,
  auditLogs = [],
  roomReservations = [],
  onNavigate,
  onOpenNewLoanModal,
  onOpenNewTicketModal,
  onOpenNewAssetModal,
}) => {
  const currentRoleKeys = currentUser?.role_keys || [];
  const isHumas = currentRoleKeys.includes('humas') || currentUser?.role === 'Humas';
  const isSekdir = currentRoleKeys.includes('sekretaris_direksi') || currentUser?.role === 'Sekretaris Direksi';
  // Legacy location labels remain compatible as employee-facing accounts; they do not grant division-wide data scope.
  const isStaff = isEmployeeFacingDashboardRole(currentUser?.role, currentRoleKeys);
  const isAuditor = GabahService.isAuditor(currentUser);
  
  const hasEffectivePermission = (permission: string, legacyRoles: string[] = []): boolean => {
    if (isAuditor) return false;
    if (currentUser.is_superadmin === true || currentUser.role === 'Admin GABAH' || currentUser.role_keys?.includes('superadmin')) return true;
    if (Array.isArray(currentUser.permission_keys)) {
      return currentUser.permission_keys.includes('*') || currentUser.permission_keys.includes(permission);
    }
    return legacyRoles.includes(currentUser.role);
  };

  const canCreateLoan = hasEffectivePermission('loans.create', ['Admin GABAH', 'IT', 'GA', 'Karyawan', 'Humas', 'Sekretaris Direksi']);
  const canCreateTicket = hasEffectivePermission('tickets.create', ['Admin GABAH', 'IT', 'GA', 'Karyawan', 'Humas', 'Sekretaris Direksi']);
  const canCreateAsset = hasEffectivePermission('assets.create', ['Admin GABAH', 'IT', 'GA']);
  
  const operationalManagementPermissions = [
    'assets.create', 'assets.update', 'assets.bulk_import', 'assets.assign',
    'assets.move', 'assets.lifecycle', 'loans.approve', 'loans.reject',
    'loans.handover', 'tickets.assign', 'tickets.update', 'maintenances.create',
    'maintenances.update', 'room_reservations.approve', 'room_reservations.reject',
    'meeting_rooms.update', 'meeting_types.manage', 'meeting_facilities.manage',
    'licenses.manage', 'knowledge.create', 'knowledge.update',
    'contracts.create', 'contracts.update', 'contracts.documents.upload',
    'vendors.create', 'vendors.update', 'organization.manage', 'master_data.manage',
  ];
  const hasOperationalManagementAccess = operationalManagementPermissions.some(permission =>
    hasEffectivePermission(permission, ['Admin GABAH', 'IT', 'GA'])
  );
  const isEmployee = !isAuditor && isStaff && !hasOperationalManagementAccess;

  const roleDescriptions: Record<UserRole, string> = {
    'Admin GABAH': 'Pantau tata kelola aset, peminjaman, helpdesk, kontrak, dan kinerja operasional seluruh unit.',
    IT: 'Pantau perangkat komputasi, lisensi software, pemeliharaan, dan antrean dukungan teknologi informasi.',
    GA: 'Pantau fasilitas kantor, kendaraan dinas, ruang rapat, peminjaman, dan layanan umum.',
    'Sekretaris Direksi': 'Ajukan dan pantau reservasi ruang rapat serta kebutuhan fasilitas kegiatan Direksi.',
    Humas: 'Pantau permintaan dokumentasi kegiatan dan agenda ruang rapat sesuai penugasan.',
    'Supply Chain': 'Akses layanan pegawai sesuai aset yang ditugaskan, peminjaman, tiket, dan reservasi.',
    PIBC: 'Akses layanan pegawai sesuai aset yang ditugaskan, peminjaman, tiket, dan reservasi.',
    Karyawan: 'Akses layanan mandiri untuk aset yang ditugaskan, peminjaman, tiket bantuan, dan reservasi ruang.',
    Auditor: 'Pemantauan read-only atas aset, peminjaman, tiket, laporan, dan jejak audit.',
  };

  const dashboardAssets = Array.isArray(assets) ? assets : [];
  const dashboardLoans = Array.isArray(loans) ? loans : [];
  const dashboardTickets = Array.isArray(tickets) ? tickets : [];
  const safeReservations = Array.isArray(roomReservations) ? roomReservations : [];
  const isGlobalDashboard = Boolean(currentUser.is_superadmin) || currentUser.role === 'Admin GABAH' || isAuditor;
  const ownerAssetCounts = dashboardAssets.reduce<Record<string, number>>((counts, asset) => {
    const owner = String(asset.owner_division || '').trim().toUpperCase();
    if (owner) counts[owner] = (counts[owner] || 0) + 1;
    return counts;
  }, {});
  const ownerAssetSummary = Object.entries(ownerAssetCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([owner, count]) => `${owner}${['SC', 'PIBC'].includes(owner) ? ' (legacy owner — review)' : ''}: ${count}`)
    .join(' • ');
  const unclassifiedOwnerAssets = dashboardAssets.filter(asset => !String(asset.owner_division || '').trim()).length;
  const isDivisionDashboard = !isGlobalDashboard && hasOperationalManagementAccess;
  
  const visibleOwnerDomains = Array.from(new Set(
    dashboardAssets.map(asset => String(asset.owner_division || '').trim().toUpperCase()).filter(Boolean)
  )).sort();
  const divisionLabel = isDivisionDashboard
    ? (visibleOwnerDomains.length > 0 ? visibleOwnerDomains.join(' / ') : 'Operasional')
    : 'Unit kerja';
  
  const attentionAssets = dashboardAssets.filter(a =>
    ['in_repair', 'damaged', 'maintenance', 'lost'].includes(a.status)
  );
  
  const isLicenseDashboard = isGlobalDashboard || hasEffectivePermission('licenses.read', ['IT']);

  // Role-aware KPI cards
  const renderKPIs = () => {
    const dashboards = [];
    
    // KPI 1: Assets (if staff or global)
    if (isEmployee || isGlobalDashboard) {
      const assignedCount = dashboardAssets.filter(a => a.assigned_to).length;
      const pendingLoans = dashboardLoans.filter(l => l.status === 'pending').length;
      dashboards.push(
        <div key="assets" className="bg-white rounded-2xl border border-[#E1EBE4] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E5F4EB] text-[#176B45] flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Aset Aktif</p>
              <p className="text-2xl font-bold text-slate-900">{dashboardAssets.length}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Laptop className="w-3 h-3" /> {assignedCount} ditugaskan</span>
            <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {pendingLoans} menunggu</span>
          </div>
          {isGlobalDashboard && (
            <p className="mt-2 text-[11px] text-slate-500">
              {ownerAssetSummary || 'Belum ada owner terklasifikasi'} • {unclassifiedOwnerAssets} tanpa owner
            </p>
          )}
        </div>
      );
    }

    // KPI 2: Loans (if staff or global)
    if (isEmployee || isGlobalDashboard) {
      const activeLoans = dashboardLoans.filter(l => l.status === 'approved' || l.status === 'pending_approval' || l.status === 'checked_out').length;
      const pending = dashboardLoans.filter(l => l.status === 'pending').length;
      dashboards.push(
        <div key="loans" className="bg-white rounded-2xl border border-[#E1EBE4] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7B733] text-white flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Peminjaman</p>
              <p className="text-2xl font-bold text-slate-900">{activeLoans}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {activeLoans} aktif</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {pending} menunggu</span>
          </div>
        </div>
      );
    }

    // KPI 3: Tickets (if staff or global)
    if (isEmployee || isGlobalDashboard) {
      const open = dashboardTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      const urgent = dashboardTickets.filter(t => t.priority === 'urgent' && ['open', 'in_progress'].includes(t.status)).length;
      dashboards.push(
        <div key="tickets" className="bg-white rounded-2xl border border-[#E1EBE4] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FC4A1A] text-white flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tiket Aktif</p>
              <p className="text-2xl font-bold text-slate-900">{open}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {urgent} urgent</span>
            <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {dashboardTickets.filter(t => t.status === 'open').length} dibuka</span>
          </div>
        </div>
      );
    }

    return dashboards;
  };

  // Role-aware section data
  const myAssignedAssets = dashboardAssets.filter(a => a.assigned_to && a.assigned_to.id === currentUser.id);
  const myOpenTickets = dashboardTickets.filter(t => t.reporter_id === currentUser.id && ['open', 'in_progress'].includes(t.status));
  const todayReservations = safeReservations.filter(r => {
    const date = new Date(r.date).toDateString();
    return date === new Date().toDateString();
  });

  return (
    <div className="gabah-dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isGlobalDashboard ? 'Dashboard KPI' : isDivisionDashboard ? `Dashboard ${divisionLabel}` : 'Dashboard Staf'}
          </h1>
          {isAuditor && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-4 w-4" /> Auditor — akses read-only. Aksi perubahan dinonaktifkan.
            </p>
          )}
          <p className="text-sm text-slate-500 mt-1">
            {isGlobalDashboard
              ? 'Ringkasan kinerja dan aktivitas terbaru seluruh unit.'
              : isDivisionDashboard
              ? `Ringkasan aktivitas di divisi ${divisionLabel}.`
              : 'Ringkasan kegiatan Anda harian.'}
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateLoan && (
            <button
              onClick={onOpenNewLoanModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#176B45] text-white text-sm font-bold hover:bg-[#1F7A50] transition-colors shadow-sm"
            >
              <CalendarClock className="w-4 h-4" />
              Ajukan Peminjaman
            </button>
          )}
          {canCreateTicket && (
            <button
              onClick={onOpenNewTicketModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 border border-[#E1EBE4] text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <LifeBuoy className="w-4 h-4" />
              Buat Tiket
            </button>
          )}
          {canCreateAsset && (
            <button
              onClick={onOpenNewAssetModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-700 border border-[#E1EBE4] text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register Aset
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      {renderKPIs().map((card, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {card}
        </div>
      ))}

      {/* Role-aware content */}
      {!isGlobalDashboard && !isDivisionDashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {!!myAssignedAssets.length && (
            <div className="bg-white rounded-2xl border border-[#E1EBE4] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#E5F4EB] text-[#176B45] flex items-center justify-center">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Aset Saya</h3>
                  <p className="text-xs text-slate-500">Perangkat kerja Anda</p>
                </div>
              </div>
              <div className="space-y-2">
                {myAssignedAssets.slice(0, 5).map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FBF8] hover:bg-[#F5FAF5] transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{asset.name}</p>
                      <p className="text-xs text-slate-500">{asset.category_type} • {asset.location}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#E5F4EB] text-[#176B45]">
                      {asset.asset_number}
                    </span>
                  </div>
                ))}
                {myAssignedAssets.length > 5 && (
                  <div className="text-xs text-slate-400 text-center py-2">
                    +{myAssignedAssets.length - 5} aset lainnya
                  </div>
                )}
              </div>
              <button
                onClick={() => onNavigate('my_assets')}
                className="mt-3 text-sm font-bold text-[#176B45] hover:text-[#218653] transition-colors"
              >
                Lihat semua aset saya →
              </button>
            </div>
          )}

          {!!myOpenTickets.length && (
            <div className="bg-white rounded-2xl border border-[#E1EBE4] p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FC4A1A] text-white flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tiket Saya</h3>
                  <p className="text-xs text-slate-500">Buatan saya yang sedang dibuka</p>
                </div>
              </div>
              <div className="space-y-2">
                {myOpenTickets.slice(0, 5).map(ticket => (
                  <div key={ticket.id} className="p-3 rounded-xl bg-[#FEF3F2] hover:bg-[#FDEDEC] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-red-700">{ticket.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{ticket.category} • {ticket.priority} • {ticket.status}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 shrink-0">
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                ))}
                {myOpenTickets.length > 5 && (
                  <div className="text-xs text-slate-400 text-center py-2">
                    +{myOpenTickets.length - 5} tiket lainnya
                  </div>
                )}
              </div>
              <button
                onClick={() => onNavigate('tickets')}
                className="mt-3 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
              >
                Lihat semua tiket →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Role-aware action shortcuts */}
      {isGlobalDashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {canCreateLoan && <button
            onClick={onOpenNewLoanModal}
            className="p-4 rounded-2xl bg-white border border-[#E1EBE4] text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E5F4EB] text-[#176B45] flex items-center justify-center mb-3">
              <CalendarClock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Ajukan Pinjam</h4>
            <p className="text-xs text-slate-500 mt-1">Buat permohonan peminjaman barang</p>
          </button>}
          {canCreateTicket && <button
            onClick={onOpenNewTicketModal}
            className="p-4 rounded-2xl bg-white border border-[#E1EBE4] text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-[#FC4A1A] text-white flex items-center justify-center mb-3">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Beri Laporan</h4>
            <p className="text-xs text-slate-500 mt-1">Buat tiket helpdesk</p>
          </button>}
          {canCreateAsset && <button
            onClick={onOpenNewAssetModal}
            className="p-4 rounded-2xl bg-white border border-[#E1EBE4] text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-[#4ABDAC] text-white flex items-center justify-center mb-3">
              <Package className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Daftarkan Aset</h4>
            <p className="text-xs text-slate-500 mt-1">Registrasi aset baru</p>
          </button>}
          <button
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-2xl bg-white border border-[#E1EBE4] text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E5F4EB] text-[#176B45] flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Laporan</h4>
            <p className="text-xs text-slate-500 mt-1">Lihat laporan operasional</p>
          </button>
        </div>
      )}

      {/* Attention alerts */}
      {(attentionAssets.length > 0 || isGlobalDashboard) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {attentionAssets.slice(0, 5).map(asset => (
            <div key={asset.id} className="bg-white rounded-2xl border border-[#E1EBE4] p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${asset.status === 'lost' ? 'bg-red-100 text-red-600' : asset.status === 'damaged' ? 'bg-amber-100 text-amber-600' : asset.status === 'in_repair' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{asset.name}</p>
                  <p className="text-xs text-slate-500">{asset.asset_number} • {asset.category_type}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Status: <span className="font-medium">{asset.status}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
