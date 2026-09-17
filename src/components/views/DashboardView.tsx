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
  Building2
} from 'lucide-react';
import { Asset, Loan, Ticket, UserProfile, AuditLog } from '../../types';
import { formatRupiah, formatDateTime, formatDate } from '../../services/gabahService';
import { NavTab } from '../Sidebar';

interface DashboardViewProps {
  assets: Asset[];
  loans: Loan[];
  tickets: Ticket[];
  currentUser: UserProfile;
  auditLogs: AuditLog[];
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
  onNavigate,
  onOpenNewLoanModal,
  onOpenNewTicketModal,
  onOpenNewAssetModal,
}) => {
  const isEmployee = currentUser?.role === 'Karyawan';
  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeLoans = Array.isArray(loans) ? loans : [];
  const safeTickets = Array.isArray(tickets) ? tickets : [];

  const itAssets = safeAssets.filter(a => a.owner_division === 'IT' || a.category_type === 'IT');
  const gaAssets = safeAssets.filter(a => a.owner_division === 'GA' || a.category_type === 'GA');
  const scAssets = safeAssets.filter(a => a.owner_division === 'SC');
  const pibcAssets = safeAssets.filter(a => a.owner_division === 'PIBC');
  const licenseAssets = safeAssets.filter(a => a.category_type === 'License');

  const totalAssetValue = safeAssets.reduce((sum, a) => sum + (a.purchase_price || a.price || 0), 0);

  const pendingLoans = safeLoans.filter(l => l.status === 'pending' || l.status === 'pending_approval');
  const activeLoans = safeLoans.filter(l => l.status === 'active' || l.status === 'approved' || l.status === 'borrowed');

  const openTickets = safeTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'assigned');
  const urgentTickets = safeTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');

  // Employee-specific filtered lists
  const currentUserName = (currentUser?.name || '').toLowerCase();
  const currentUserId = currentUser?.id || '';

  const myLoans = safeLoans.filter(l => {
    const bName = (l.borrower_name || '').toLowerCase();
    return (
      l.borrower_id === currentUserId ||
      (bName && currentUserName && (bName.includes(currentUserName) || currentUserName.includes(bName)))
    );
  });
  const myActiveLoans = myLoans.filter(l => l.status === 'active' || l.status === 'approved' || l.status === 'borrowed');
  const myPendingLoans = myLoans.filter(l => l.status === 'pending' || l.status === 'pending_approval');

  const myTickets = safeTickets.filter(t => {
    const rName = (t.reporter_name || '').toLowerCase();
    return (
      t.reporter_id === currentUserId ||
      (rName && currentUserName && (rName.includes(currentUserName) || currentUserName.includes(rName)))
    );
  });
  const myOpenTickets = myTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'assigned');

  const myAssignedAssets = safeAssets.filter(a => {
    if (!a.assigned_to) return false;
    const assignedId = a.assigned_to.id;
    const assignedEmail = a.assigned_to.email?.toLowerCase();
    const currentEmail = currentUser?.email?.toLowerCase();
    const assignedName = a.assigned_to.name?.toLowerCase();
    return (
      assignedId === currentUserId ||
      (assignedEmail && currentEmail && assignedEmail === currentEmail) ||
      (assignedName && currentUserName && (assignedName.includes(currentUserName) || currentUserName.includes(assignedName)))
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
              {isEmployee 
                ? `Portal layanan mandiri pegawai PT Food Station Tjipinang Jaya: ajukan pinjaman kendaraan operasional, laptop cadangan, atau sampaikan kendala fasilitas.`
                : `Portal terpadu aset Pasar Induk Beras Cipinang (PIBC): Aset IT, Armada Logistik GA, Lisensi Software, Helpdesk SLA, dan Peminjaman Terjadwal.`
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-quick-loan"
              onClick={onOpenNewLoanModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <CalendarClock className="w-4 h-4" />
              Pinjam Aset
            </button>
            <button
              id="btn-quick-ticket"
              onClick={onOpenNewTicketModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold transition-all shadow-xs"
            >
              <LifeBuoy className="w-4 h-4 text-rose-600" />
              Buat Tiket Kendala
            </button>
            {!isEmployee && (
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
        /* Employee KPI Stats (4 Cards: Aset Saya, Peminjaman, Tiket, Knowledge Base) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Aset Saya */}
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ruang Rapat &amp; GA</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">Reservasi Rapat</div>
              <div className="text-xs text-emerald-700 font-medium mt-1">
                Fasilitas Hybrid, TV &amp; Pantry
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Pesan &amp; Cek Jadwal</span>
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
              <div className="text-2xl font-black text-slate-900">{assets.length} Item</div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-medium flex-wrap gap-1">
                <span>{itAssets.length} IT • {gaAssets.length} GA • {scAssets.length} SC • {pibcAssets.length} PIBC • {licenseAssets.length} Lisensi</span>
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
                Target Penyelesaian: 98.4% On-Time
              </div>
            </div>
          </div>

          {/* Lisensi Software & Cloud */}
          <div 
            onClick={() => onNavigate('licenses')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all hover:translate-y-[-2px] group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Lisensi &amp; Subscription</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <KeyRound className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900">{licenseAssets.length} Kontrak Aktif</div>
              <div className="text-xs text-indigo-700 font-medium mt-1">
                M365, Adobe CC, Sophos XDR, AWS
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-2 pt-2 border-t border-slate-100 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                1 Lisensi mendekati renewal (54 hari)
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Main Content Layout */}
      {isEmployee ? (
        /* Employee View: Shows only user's loans & user's tickets (No general helpdesk queue, no audit log) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Peminjaman Saya (8 cols) */}
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

          {/* Tiket Bantuan Saya (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-rose-600" />
                Tiket Kendala Saya
              </h3>
              <button
                onClick={() => onNavigate('tickets')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
              >
                Lihat Semua
              </button>
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
                  Jadwal Peminjaman Aset Terintegrasi
                </h3>
                <p className="text-xs text-slate-500">Reservasi mobil dinas, laptop cadangan, dan fasilitas ruang rapat</p>
              </div>
              <button
                onClick={() => onNavigate('loans')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
              >
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {loans.slice(0, 4).map((loan) => {
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
                  Antrean Helpdesk
                </h3>
                <button
                  onClick={() => onNavigate('tickets')}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="space-y-3">
                {tickets.slice(0, 3).map((t) => (
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

            {/* Audit Trail Activity */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Audit Log Aktivitas Terakhir
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

          </div>

        </div>
      )}

    </div>
  );
};
