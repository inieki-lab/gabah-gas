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
  Camera
} from 'lucide-react';
import { Asset, Loan, Ticket, UserProfile, UserRole, AuditLog, RoomReservation } from '../../types';
import { formatRupiah, formatDateTime, formatDate } from '../../services/gabahService';
import { NavTab } from '../Sidebar';

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
  const isStaff = currentUser?.role === 'Karyawan' || currentUser?.role === 'Sekretaris Direksi' || currentUser?.role === 'Humas';
  const isEmployee = isStaff;
  const isHumas = currentUser?.role === 'Humas';
  const isSekdir = currentUser?.role === 'Sekretaris Direksi';
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

  // All collections arrive pre-scoped by backend permissions and module scope.
  // Do not re-filter them by a single legacy role name in the browser.
  const dashboardAssets = Array.isArray(assets) ? assets : [];
  const dashboardLoans = Array.isArray(loans) ? loans : [];
  const dashboardTickets = Array.isArray(tickets) ? tickets : [];
  const safeLoans = dashboardLoans;
  const safeTickets = dashboardTickets;
  const safeReservations = Array.isArray(roomReservations) ? roomReservations : [];
  const isGlobalDashboard = Boolean(currentUser.is_superadmin) || currentUser.role === 'Admin GABAH' || currentUser.role === 'Auditor';
  const isDivisionDashboard = currentUser.role === 'IT' || currentUser.role === 'GA';
  const divisionLabel = isDivisionDashboard ? currentUser.role : 'Unit kerja';
  const attentionAssets = dashboardAssets.filter(a =>
    ['in_repair', 'damaged', 'maintenance', 'lost'].includes(a.status)
  );
  const isLicenseDashboard = isGlobalDashboard || currentUser.role === 'IT' || Boolean(currentUser.permission_keys?.includes('licenses.read'));
  const roleDescription = currentUser.role_keys?.includes('humas') || currentUser.role === 'Humas'
    ? roleDescriptions.Humas
    : currentUser.role_keys?.includes('sekretaris_direksi') || currentUser.role === 'Sekretaris Direksi'
      ? roleDescriptions['Sekretaris Direksi']
      : roleDescriptions[currentUser.role];
  const expiringLicenses = dashboardAssets.filter(asset => {
    const expiry = asset.license_detail?.expiration_date;
    if (!expiry) return false;
    const expiryDate = new Date(`${expiry}T00:00:00`);
    if (Number.isNaN(expiryDate.getTime())) return false;
    const daysRemaining = Math.ceil((expiryDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    return daysRemaining >= 0 && daysRemaining <= 60;
  });

  const docReservations = safeReservations.filter(
    r => r.documentation_requested && !['cancelled', 'rejected'].includes(r.status)
  );
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayMeetings = safeReservations.filter(r => r.date === todayStr && !['cancelled', 'rejected'].includes(r.status));

  const itAssets = dashboardAssets.filter(a => a.owner_division === 'IT');
  const gaAssets = dashboardAssets.filter(a => a.owner_division === 'GA');
  const scAssets = dashboardAssets.filter(a => a.owner_division === 'SC');
  const pibcAssets = dashboardAssets.filter(a => a.owner_division === 'PIBC');
  const licenseAssets = dashboardAssets.filter(a => a.category_type === 'License');

  const totalAssetValue = dashboardAssets.reduce((sum, a) => sum + (a.purchase_price || a.price || 0), 0);

  const pendingLoans = dashboardLoans.filter(l => l.status === 'pending');
  const activeLoans = dashboardLoans.filter(l => l.status === 'active' || l.status === 'approved' || l.status === 'overdue');

  const openTickets = dashboardTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'pending_vendor');
  const urgentTickets = dashboardTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');

  // Employee-specific filtered lists
  const currentUserId = currentUser?.id || '';

  const myLoans = safeLoans.filter(l => {
    return (
      l.borrower_id === currentUserId
    );
  });
  const myActiveLoans = myLoans.filter(l => l.status === 'active' || l.status === 'approved' || l.status === 'overdue');
  const myPendingLoans = myLoans.filter(l => l.status === 'pending_approval');

  const myTickets = safeTickets.filter(t => {
    return (
      t.reporter_id === currentUserId
    );
  });
  const myOpenTickets = myTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'pending_vendor');

  const myAssignedAssets = dashboardAssets.filter(a => {
    if (!a.assigned_to) return false;
    const assignedId = a.assigned_to.id;
    return (
      assignedId === currentUserId
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner with Fast Actions (Clean White) */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sistem Aktif: GABAH Food Station Enterprise
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Selamat Datang, {currentUser.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl font-normal">
              {roleDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentUser.role !== 'Auditor' && (
              <button
                id="btn-quick-loan"
                onClick={onOpenNewLoanModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
              >
                <CalendarClock className="w-4 h-4" />
                Pinjam Aset
              </button>
            )}
            {currentUser?.role !== 'Auditor' ? (
              <button
                id="btn-quick-ticket"
                onClick={onOpenNewTicketModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all shadow-xs"
              >
                <LifeBuoy className="w-4 h-4 text-rose-600" />
                Buat Tiket Kendala
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold" title="Auditor berstatus Read-Only">
                <LifeBuoy className="w-4 h-4 text-slate-400" />
                <span>Tiket (Read-Only)</span>
              </div>
            )}
            {!isEmployee && currentUser?.role !== 'Auditor' && (
              <button
                id="btn-quick-asset"
                onClick={onOpenNewAssetModal}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition-all"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                Registrasi Aset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      {isEmployee ? (
        /* Employee KPI Stats (4 Cards) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: If Humas -> Request Foto Dokumentasi; If other staff -> Aset Saya */}
          {isHumas ? (
            <div 
              onClick={() => onNavigate('meeting_rooms')}
              className="p-5 rounded-2xl bg-white border border-sky-200 hover:border-sky-400 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Request Foto Rapat</span>
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{docReservations.length} Permintaan</div>
                <div className="text-xs text-sky-700 mt-1 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  Bebas Ruangan Mana Saja
                </div>
                <div className="text-[11px] text-sky-700 font-bold mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>Lihat Agenda Liputan</span>
                  <ArrowRight className="w-3 h-3 text-sky-600" />
                </div>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => onNavigate('my_assets')}
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Aset Saya</span>
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Laptop className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{myAssignedAssets.length} Unit</div>
                <div className="text-xs text-blue-700 mt-1 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Perangkat Kerja Ditugaskan
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>Inventaris Tetap</span>
                  <ArrowRight className="w-3 h-3 text-blue-600" />
                </div>
              </div>
            </div>
          )}

          {/* Peminjaman Saya */}
          <div 
            onClick={() => onNavigate('loans')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Peminjaman Saya</span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarClock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{myLoans.length} Reservasi</div>
              <div className="text-xs text-amber-700 mt-1 flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5" />
                {myActiveLoans.length} Aktif • {myPendingLoans.length} Menunggu
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Sirkulasi Inventaris</span>
                <ArrowRight className="w-3 h-3 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Tiket Kendala Saya */}
          <div 
            onClick={() => onNavigate('tickets')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiket Kendala Saya</span>
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <LifeBuoy className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{myTickets.length} Tiket</div>
              <div className="text-xs text-rose-700 mt-1 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {myOpenTickets.length} Sedang Ditangani Tim
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Layanan Helpdesk PIBC</span>
                <ArrowRight className="w-3 h-3 text-rose-600" />
              </div>
            </div>
          </div>

          {/* Ruang Rapat & Fasilitas GA */}
          <div 
            onClick={() => onNavigate('meeting_rooms')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isHumas ? 'Agenda Ruang Rapat' : 'Ruang Rapat & GA'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{todayMeetings.length} Hari Ini</div>
              <div className="text-xs text-emerald-700 font-medium mt-1">
                {safeReservations.length} Total Jadwal Rapat
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>{isHumas ? 'Pantau Semua Ruang' : 'Pesan & Cek Jadwal'}</span>
                <ArrowRight className="w-3 h-3 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Admin KPI Stats (Full view) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Aset */}
          <div 
            onClick={() => onNavigate('assets')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Aset Fisik &amp; Lisensi</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{dashboardAssets.length} Item</div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-medium flex-wrap gap-1">
                <span>{isGlobalDashboard ? `${itAssets.length} IT • ${gaAssets.length} GA • ${scAssets.length} owner legacy SC • ${pibcAssets.length} owner legacy PIBC • ${licenseAssets.length} Lisensi` : isDivisionDashboard ? `${divisionLabel} • ${dashboardAssets.length} aset dalam cakupan` : `${dashboardAssets.length} aset dalam cakupan`}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-slate-100">
                Valuasi: {formatRupiah(totalAssetValue)}
              </div>
            </div>
          </div>

          {/* Peminjaman Aktif */}
          <div 
            onClick={() => onNavigate('loans')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Peminjaman Berjalan</span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarClock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{activeLoans.length} Reservasi</div>
              <div className="text-xs text-amber-700 mt-1 flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5" />
                {pendingLoans.length} Menunggu Persetujuan
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Validasi Jadwal Siaga
              </div>
            </div>
          </div>

          {/* Tiket Helpdesk & SLA */}
          <div 
            onClick={() => onNavigate('tickets')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiket Helpdesk Terbuka</span>
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <LifeBuoy className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{openTickets.length} Tiket</div>
              <div className="text-xs text-rose-700 mt-1 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {urgentTickets.length} Prioritas Darurat (SLA 4 Jam)
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100">
                {urgentTickets.length} tiket prioritas darurat belum selesai
              </div>
            </div>
          </div>

          {/* Lisensi Software & Cloud */}
          <div 
            onClick={() => onNavigate('licenses')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isLicenseDashboard ? 'Lisensi &amp; Subscription' : 'Aset Perlu Perhatian'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                {isLicenseDashboard ? <KeyRound className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">
                {isLicenseDashboard ? `${licenseAssets.length} Lisensi` : `${attentionAssets.length} Aset`}
              </div>
              <div className="text-xs text-indigo-700 font-medium mt-1">
                {isLicenseDashboard ? 'Lisensi terdaftar pada cakupan Anda' : 'Rusak, maintenance, hilang, atau perbaikan'}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isLicenseDashboard ? `${expiringLicenses.length} lisensi jatuh tempo dalam 60 hari` : 'Perlu pemeriksaan dan tindak lanjut'}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Main Content Layout */}
      {isEmployee ? (
        /* Employee View: Shows only user's loans & user's tickets, or Humas photo requests */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main 8 Cols: If Humas -> Antrean Request Foto Ruang Rapat; If other staff -> Peminjaman Barang Saya */}
          {isHumas ? (
            <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-sky-600" />
                    Permintaan Dokumentasi &amp; Foto Rapat (Semua Ruangan)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Antrean permohonan liputan foto kegiatan &amp; dokumentasi acara rapat dari seluruh unit kerja (bebas ruang mana saja)
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('meeting_rooms')}
                  className="text-xs text-sky-700 hover:text-sky-800 font-bold flex items-center gap-1"
                >
                  Buka Ruang Rapat <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {docReservations.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Belum Ada Permintaan Liputan Foto</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Saat ini tidak ada permohonan dokumentasi aktif di seluruh ruang rapat. Anda dapat memantau jadwal ruang rapat sewaktu-waktu.
                  </p>
                  <button
                    onClick={() => onNavigate('meeting_rooms')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Building2 className="w-4 h-4" />
                    Lihat Semua Jadwal Rapat
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {docReservations.map((res) => (
                    <div 
                      key={res.id}
                      className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80 hover:border-sky-300 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-sky-500 text-white mt-0.5 shadow-xs shrink-0">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{res.title}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-sky-800 border border-sky-300 shadow-2xs">
                              {res.room_name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                            <span>Tanggal: <strong>{res.date}</strong></span>
                            <span>•</span>
                            <span>Waktu: <strong>{res.start_time} - {res.end_time} WIB</strong></span>
                            <span>•</span>
                            <span>Pemohon: <strong>{res.organizer_name}</strong> ({res.organizer_department})</span>
                          </div>
                          {res.documentation_notes && (
                            <p className="text-xs text-sky-900 bg-sky-100/70 p-2 rounded-lg mt-2 border border-sky-200 font-medium">
                              📸 <strong>Instruksi Liputan Humas:</strong> {res.documentation_notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1.5">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          res.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          res.status === 'in_use' ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {res.status === 'approved' ? 'Disetujui GA' : res.status === 'in_use' ? 'Sedang Berlangsung' : 'Menunggu GA'}
                        </span>
                        <button
                          onClick={() => onNavigate('meeting_rooms')}
                          className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1 mt-1"
                        >
                          Buka Agenda Rapat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Standard Employee Peminjaman Saya (8 cols) */
            <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-emerald-600" />
                    Peminjaman Barang Saya
                  </h3>
                  <p className="text-xs text-slate-500">Daftar riwayat dan pengajuan peminjaman aset yang Anda ajukan</p>
                </div>
                <button
                  onClick={() => onNavigate('loans')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                >
                  Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {myLoans.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <CalendarClock className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Belum Ada Peminjaman Barang</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Anda belum memiliki pengajuan peminjaman aset saat ini. Anda dapat meminjam mobil dinas, laptop cadangan, atau ruangan rapat.
                  </p>
                  <button
                    onClick={onOpenNewLoanModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Ajukan Peminjaman Sekarang
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myLoans.map((loan) => (
                    <div 
                      key={loan.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${loan.category_type === 'IT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {loan.category_type === 'IT' ? <Laptop className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{loan.asset_name}</span>
                            {loan.corporate_asset_number && (
                              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white text-emerald-800 border border-emerald-300 font-bold">
                                {loan.corporate_asset_number}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{loan.purpose}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                            <span>Jadwal: <strong>{formatDateTime(loan.start_date)}</strong> s/d <strong>{formatDateTime(loan.due_date)}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          loan.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          loan.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          loan.status === 'returned' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {loan.status}
                        </span>
                        {loan.approver_name && (
                          <span className="text-[10px] text-slate-500 mt-1">Disetujui: {loan.approver_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tiket Bantuan Saya (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-rose-600" />
                Tiket Kendala Saya
              </h3>
              <div className="flex items-center gap-2">
                {currentUser?.role !== 'Auditor' && (
                  <button
                    onClick={onOpenNewTicketModal}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lapor Kendala Baru
                  </button>
                )}
                <button
                  onClick={() => onNavigate('tickets')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
                >
                  Lihat Semua
                </button>
              </div>
            </div>

            {myTickets.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Tidak Ada Kendala Aktif</p>
                <p className="text-[11px] text-slate-500">
                  Seluruh perangkat dan fasilitas Anda dalam kondisi prima.
                </p>
                <button
                  onClick={onOpenNewTicketModal}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:underline inline-block"
                >
                  + Lapor Kendala Baru
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myTickets.slice(0, 4).map((t) => (
                  <div 
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-slate-500">{t.ticket_code}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'urgent' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        t.priority === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 line-clamp-2">{t.title}</h4>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>Prioritas: <strong className="uppercase">{t.priority}</strong></span>
                      <span className="text-emerald-700 font-bold">SLA: {t.sla_hours} Jam</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Admin View: Full Reservations + Urgent Queue + Audit Trail */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (2 spans): Active & Upcoming Loans */}
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-emerald-600" />
                  {isDivisionDashboard ? `Jadwal Peminjaman ${divisionLabel}` : currentUser.role === 'Auditor' ? 'Pemantauan Peminjaman Lintas Divisi' : 'Jadwal Peminjaman Aset Terintegrasi'}
                </h3>
                <p className="text-xs text-slate-500">{isDivisionDashboard ? `Data peminjaman yang terkait dengan pengelolaan ${divisionLabel}` : currentUser.role === 'Auditor' ? 'Ringkasan read-only peminjaman lintas unit kerja' : 'Reservasi mobil dinas, laptop cadangan, dan fasilitas ruang rapat'}</p>
              </div>
              <button
                onClick={() => onNavigate('loans')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
              >
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {dashboardLoans.slice(0, 4).map((loan) => {
                return (
                  <div 
                    key={loan.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 ${loan.category_type === 'IT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {loan.category_type === 'IT' ? <Laptop className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{loan.asset_name}</span>
                          {loan.corporate_asset_number && (
                            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white text-emerald-800 border border-emerald-300 font-bold">
                              {loan.corporate_asset_number}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{loan.purpose}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                          <span>Peminjam: <strong className="text-slate-800">{loan.borrower_name}</strong> ({loan.borrower_department})</span>
                          <span>•</span>
                          <span>Jadwal: {formatDateTime(loan.start_date)} - {formatDateTime(loan.due_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        loan.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        loan.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        loan.status === 'returned' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {loan.status}
                      </span>
                      {loan.approver_name && (
                        <span className="text-[10px] text-slate-500 mt-1">Disetujui: {loan.approver_name}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Helpdesk Queue & Audit Trail */}
          <div className="space-y-6">
            
            {/* Urgent Tickets Panel */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-rose-600" />
                  {currentUser.role === 'IT' ? 'Antrean Helpdesk TI' : currentUser.role === 'Auditor' ? 'Pemantauan Tiket Helpdesk' : `Tiket Helpdesk ${divisionLabel}`}
                </h3>
                <div className="flex items-center gap-2">
                  {currentUser?.role !== 'Auditor' && (
                    <button
                      onClick={onOpenNewTicketModal}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Lapor Kendala
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('tickets')}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
                  >
                    Lihat Semua
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {dashboardTickets.slice(0, 3).map((t) => (
                  <div 
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-slate-500">{t.ticket_code}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'urgent' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        t.priority === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 line-clamp-2">{t.title}</h4>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>Oleh: {t.reporter_name}</span>
                      <span className="text-emerald-700 font-bold">SLA: {t.sla_hours} Jam</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!isDivisionDashboard ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {currentUser.role === 'Auditor' ? 'Audit Log Lintas Divisi' : 'Audit Log Aktivitas Terakhir'}
              </h3>
              <div className="space-y-2.5 text-xs">
                {auditLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span className="font-bold text-emerald-700">{log.user_name} ({log.role})</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <p className="text-slate-700 text-xs mt-0.5">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}

          </div>

        </div>
      )}

    </div>
  );
};
