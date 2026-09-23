import React, { useState } from 'react';
import { 
  LifeBuoy, 
  Plus, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  User, 
  Laptop, 
  Car, 
  KeyRound, 
  MessageSquare, 
  Filter, 
  Search,
  CheckCircle,
  Tag,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Sparkles,
  Check
} from 'lucide-react';
import { Asset, Ticket, AssetCategoryType, TicketPriority, TicketStatus, UserProfile } from '../../types';
import { formatDateTime, GabahService, exportTicketsToCsv } from '../../services/gabahService';

interface TicketsViewProps {
  tickets?: Ticket[];
  assets?: Asset[];
  currentUser: UserProfile;
  onOpenCreateModal?: () => void;
  onOpenNewTicketModal?: () => void;
  onUpdateTicketStatus: (ticketId: string, status: TicketStatus, notes?: string) => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  tickets = [],
  assets = [],
  currentUser,
  onOpenCreateModal,
  onOpenNewTicketModal,
  onUpdateTicketStatus,
}) => {
  const handleOpenCreate = onOpenCreateModal || onOpenNewTicketModal || (() => {});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Freshservice Canned Responses
  const cannedSolutions = [
    'Perbaikan perangkat telah selesai dan diverifikasi kembali oleh pengguna berfungsi normal.',
    'Pembersihan filter & pemeliharaan rutin AC telah dilakukan, suhu ruangan kembali sejuk optimal.',
    'Kredensial akun sistem / akses VPN telah direset dan berhasil digunakan login.',
    'Penggantian komponen baru telah dilakukan dan unit telah lolos uji kelayakan operasional.',
    'Dokumen BAST serah terima perangkat pengganti telah diterbitkan secara resmi melalui GABAH.',
  ];

  const isSuperAdmin = currentUser?.role === 'Admin GABAH';
  const isIT = currentUser?.role === 'IT';
  const isGA = currentUser?.role === 'GA';
  // Per instruction: all users except IT, super admin, and GA (for GA tickets) only see their own tickets
  const isSelfTicketsOnly = !isSuperAdmin && !isIT && !isGA;
  const isEmployee = isSelfTicketsOnly;

  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const baseTickets = safeTickets.filter(t => GabahService.isTicketVisibleToUser(t, currentUser));

  const baseCategorySet = new Set(baseTickets.map(t => t.category).filter(Boolean));
  const defaultCategories = isSelfTicketsOnly
    ? ['ALL', ...Array.from(baseCategorySet)]
    : isGA
    ? ['ALL', 'GA', ...Array.from(baseCategorySet).filter(c => c !== 'GA')]
    : ['ALL', 'IT', 'GA', 'License', 'General'];
  const availableCategories = Array.from(new Set(defaultCategories));

  const filteredTickets = baseTickets.filter((t) => {
    if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        (t.title || '').toLowerCase().includes(q) ||
        (t.ticket_code || '').toLowerCase().includes(q) ||
        (t.reporter_name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const canManage = GabahService.canManageTickets(currentUser);

  // SLA Helper
  const getSlaInfo = (ticket: Ticket) => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return {
        text: 'SLA Terpenuhi',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: CheckCircle2,
      };
    }

    const hours = ticket.sla_hours || (ticket.priority === 'urgent' ? 4 : ticket.priority === 'high' ? 8 : ticket.priority === 'medium' ? 24 : 48);
    const createdTime = new Date(ticket.created_at || Date.now()).getTime();
    const deadlineTime = createdTime + hours * 3600 * 1000;
    const now = Date.now();

    if (now > deadlineTime) {
      const hoursOver = Math.max(1, Math.floor((now - deadlineTime) / 3600000));
      return {
        text: `SLA Lewat +${hoursOver}j`,
        className: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        icon: AlertTriangle,
      };
    } else {
      const hoursLeft = Math.floor((deadlineTime - now) / 3600000);
      const minsLeft = Math.floor(((deadlineTime - now) % 3600000) / 60000);
      return {
        text: `Sisa SLA: ${hoursLeft}j ${minsLeft}m`,
        className: hoursLeft <= 2 ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold' : 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Clock,
      };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-rose-600" />
            {isSelfTicketsOnly 
              ? 'Tiket Helpdesk Saya' 
              : isGA 
              ? 'Helpdesk & Tiket Layanan GA' 
              : 'Helpdesk & Tiket Layanan Internal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isSelfTicketsOnly 
              ? 'Daftar pengajuan kendala teknis, kerusakan fasilitas, dan permohonan bantuan Anda.'
              : isGA
              ? 'Daftar tiket kendala fasilitas gedung & sarana GA, serta tiket kendala yang Anda ajukan.'
              : 'Laporan insiden, kerusakan perangkat IT, pemeliharaan fasilitas GA, dan permintaan lisensi software.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportTicketsToCsv(filteredTickets)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Rekapitulasi Tiket Helpdesk untuk Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            id="btn-create-ticket"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Buat Tiket Baru
          </button>
        </div>
      </div>

      {/* SLA Policy Summary (Shown for IT, Super Admin, and GA) */}
      {!isSelfTicketsOnly && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800">
              <span>SLA Urgent</span>
              <span className="font-mono bg-rose-100 px-1.5 py-0.5 rounded">4 Jam</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Gedung, server down, AC bocor parah</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span>SLA High</span>
              <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">8 Jam</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">VPN putus, laptop kerja utama mati</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between text-xs font-bold text-blue-800">
              <span>SLA Medium</span>
              <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">24 Jam</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Permintaan akun software &amp; lisensi</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>SLA Low</span>
              <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded">48 Jam</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Penggantian mouse/keyboard perifer</p>
          </div>
        </div>
      )}

      {/* Search and Filters + View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kode tiket (TKT-24-0088), judul kendala, nama pelapor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>

          {/* Freshservice-style View Mode Switcher: List vs Kanban */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Tampilan Daftar (List View)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Daftar</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Papan Kanban (Kanban Board)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* Freshservice Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'open', title: 'Tiket Masuk (Open)', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300' },
            { id: 'in_progress', title: 'Dalam Penanganan (In Progress)', badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
            { id: 'resolved', title: 'Selesai & Solusi (Resolved)', badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
          ].map(col => {
            const colTickets = filteredTickets.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3 space-y-3 flex flex-col min-h-[420px]">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                    <span>{col.title}</span>
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${col.badgeBg}`}>
                    {colTickets.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTickets.map(ticket => {
                    const sla = getSlaInfo(ticket);
                    const SlaIcon = sla.icon;
                    return (
                      <div key={ticket.id} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5 hover:border-slate-300 transition-all">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-slate-500">{ticket.ticket_code}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${sla.className}`}>
                            <SlaIcon className="w-3 h-3" />
                            {sla.text}
                          </span>
                        </div>

                        <div>
                          <h5 className="font-bold text-slate-900 text-xs line-clamp-2">{ticket.title}</h5>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{ticket.description}</p>
                        </div>

                        {ticket.related_asset_name && (
                          <div className="text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-200 truncate text-slate-600">
                            <strong>Aset:</strong> {ticket.related_asset_name}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                          <span>{ticket.reporter_name} ({ticket.category})</span>
                          {GabahService.canManageTicket(ticket, currentUser) && (
                            <div>
                              {ticket.status === 'open' && (
                                <button
                                  onClick={() => onUpdateTicketStatus(ticket.id, 'in_progress')}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[10px] transition-all"
                                >
                                  Kerjakan
                                </button>
                              )}
                              {ticket.status === 'in_progress' && (
                                <button
                                  onClick={() => setResolvingTicketId(ticket.id)}
                                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-[10px] flex items-center gap-1 transition-all"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Selesai
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colTickets.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
                      Kosong
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Standard List View */
        <div className="space-y-3.5">
          {filteredTickets.map((ticket) => {
            const isUrgent = ticket.priority === 'urgent';
            const isHigh = ticket.priority === 'high';
            const sla = getSlaInfo(ticket);
            const SlaIcon = sla.icon;

            return (
              <div 
                key={ticket.id}
                className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs"
              >
                
                {/* Header row: Code, Priority, Status, SLA countdown */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-400">{ticket.ticket_code}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isUrgent ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      isHigh ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {ticket.priority} (SLA: {ticket.sla_hours} Jam)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {ticket.category}
                    </span>

                    {/* Freshservice-style dynamic SLA badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${sla.className}`}>
                      <SlaIcon className="w-3.5 h-3.5" />
                      {sla.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      ticket.status === 'in_progress' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900">{ticket.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ticket.description}</p>
                </div>

                {/* Related Asset Badge (if any) */}
                {ticket.related_asset_name && (
                  <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 w-fit">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-500">Terkait Aset:</span>
                    <strong className="text-slate-900">{ticket.related_asset_name}</strong>
                    {ticket.related_asset_number && (
                      <span className="font-mono text-emerald-700 text-[11px] font-bold">
                        ({ticket.related_asset_number})
                      </span>
                    )}
                  </div>
                )}

                {/* Footer row: Reporter, Assignee, Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      Pelapor: <strong className="text-slate-800">{ticket.reporter_name}</strong> ({ticket.reporter_department})
                    </div>
                    <div>•</div>
                    <div>
                      Teknisi: <strong className="text-emerald-700 font-semibold">{ticket.assigned_agent_name || 'Belum di-assign'}</strong>
                    </div>
                  </div>

                  {/* Status action buttons */}
                  {GabahService.canManageTicket(ticket, currentUser) && (
                    <div className="flex items-center gap-2">
                      {ticket.status === 'open' && (
                        <button
                          onClick={() => onUpdateTicketStatus(ticket.id, 'in_progress')}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-xs shadow-xs"
                        >
                          Mulai Kerjakan
                        </button>
                      )}

                      {ticket.status === 'in_progress' && (
                        <button
                          onClick={() => setResolvingTicketId(ticket.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all text-xs flex items-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Selesaikan Tiket
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Resolution Notes preview if resolved */}
                {ticket.resolution_notes && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    <strong className="font-bold">Solusi Penanganan:</strong> {ticket.resolution_notes}
                  </div>
                )}

              </div>
            );
          })}

          {filteredTickets.length === 0 && (
            <div className="text-center py-12 rounded-2xl bg-white border border-slate-200 p-8 space-y-3 shadow-xs">
              <LifeBuoy className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="font-bold text-slate-800 text-sm">
                {isSelfTicketsOnly 
                  ? 'Belum Ada Tiket Kendala dari Anda' 
                  : isGA 
                  ? 'Belum Ada Tiket Layanan GA'
                  : 'Tidak Ada Tiket Ditemukan'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isSelfTicketsOnly 
                  ? 'Anda belum memiliki riwayat pengajuan tiket kendala. Klik "Buat Tiket Baru" jika Anda mengalami gangguan IT atau fasilitas kantor.'
                  : isGA
                  ? 'Tidak ada tiket kendala fasilitas GA yang menunggu penanganan.'
                  : 'Tidak ada tiket yang cocok dengan pencarian atau filter status yang dipilih.'}
              </p>
              {isSelfTicketsOnly && (
                <button
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Buat Tiket Baru
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resolve Modal with Freshservice Canned Responses */}
      {resolvingTicketId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Selesaikan Tiket Helpdesk
            </h3>
            <p className="text-xs text-slate-600">Tuliskan solusi atau tindakan perbaikan yang telah dilakukan untuk pemohon:</p>

            {/* Freshservice-style Quick Canned Response Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Templat Solusi Cepat (Canned Responses):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cannedSolutions.map((canned, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setResolutionNotes(canned)}
                    className="text-[10px] text-left px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 transition-all truncate max-w-full"
                  >
                    + {canned}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Contoh: Pembersihan saluran pembuangan air AC dan penggantian filter, unit kembali bekerja normal..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResolvingTicketId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onUpdateTicketStatus(resolvingTicketId, 'resolved', resolutionNotes || 'Masalah telah diselesaikan oleh tim teknisi.');
                  setResolvingTicketId(null);
                  setResolutionNotes('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs"
              >
                Tandai Selesai &amp; Kirim
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
