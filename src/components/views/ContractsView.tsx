import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  AlertTriangle,
  CalendarClock,
  Search,
  ShieldAlert,
  Building,
  RefreshCw,
  Link2,
  History,
  CheckCircle2,
  XCircle,
  BellRing,
} from 'lucide-react';
import { Contract, ContractStatus, UserProfile } from '../../types';
import { formatRupiah, formatDate, formatDateTime } from '../../services/gabahService';
import { gabahApi } from '../../services/gabahApi';

interface ContractsViewProps {
  contracts: Contract[];
  currentUser: UserProfile;
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'info') => void;
  onCreateContract: () => void;
  onCreateLinkedTicket: (contract: Contract) => void;
}

const STATUS_META: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  active: { label: 'Aktif', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  expiring: { label: 'Segera Berakhir', className: 'bg-amber-50 text-amber-800 border-amber-300' },
  renewal_in_progress: { label: 'Renewal Berjalan', className: 'bg-blue-50 text-blue-800 border-blue-300' },
  renewed: { label: 'Diperbarui', className: 'bg-teal-50 text-teal-800 border-teal-300' },
  terminated: { label: 'Dihentikan', className: 'bg-stone-100 text-stone-700 border-stone-300' },
  expired: { label: 'Kedaluwarsa', className: 'bg-rose-50 text-rose-800 border-rose-300' },
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 3600 * 1000));
}

/** Reminder level with explicit text (accessibility: not color-only). */
function reminderBadge(contract: Contract): { label: string; className: string } {
  const d = daysUntil(contract.end_date);
  const c = contract.reminder_config;
  if (d < 0) return { label: `KEDALUWARSA (${Math.abs(d)} hari lalu)`, className: 'bg-rose-100 text-rose-900 border-rose-400 font-bold' };
  if (d <= c.reminder3_days) return { label: `KRITIS — sisa ${d} hari`, className: 'bg-rose-100 text-rose-900 border-rose-400 font-bold animate-pulse' };
  if (d <= c.reminder2_days) return { label: `SEGERA — sisa ${d} hari`, className: 'bg-orange-100 text-orange-900 border-orange-400 font-bold' };
  if (d <= c.reminder1_days) return { label: `Peringatan — sisa ${d} hari`, className: 'bg-amber-50 text-amber-800 border-amber-300' };
  return { label: `Normal — sisa ${d} hari`, className: 'bg-slate-50 text-slate-600 border-slate-200' };
}

export const ContractsView: React.FC<ContractsViewProps> = ({
  contracts,
  currentUser,
  onRefresh,
  showToast,
  onCreateContract,
  onCreateLinkedTicket,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifLogs, setNotifLogs] = useState<Record<string, any[]>>({});
  const [isRunningSweep, setIsRunningSweep] = useState(false);

  const isAdmin = currentUser.role === 'Admin GABAH';

  const vendors = useMemo(() => Array.from(new Set(contracts.map(c => c.vendor_name))).sort(), [contracts]);
  const types = useMemo(() => Array.from(new Set(contracts.map(c => c.contract_type))).sort(), [contracts]);

  const filtered = contracts.filter(c => {
    if (deptFilter !== 'ALL' && c.owner_division !== deptFilter) return false;
    if (vendorFilter !== 'ALL' && c.vendor_name !== vendorFilter) return false;
    if (typeFilter !== 'ALL' && c.contract_type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.contract_number.toLowerCase().includes(q) ||
        c.vendor_name.toLowerCase().includes(q) ||
        (c.pic_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    active: contracts.filter(c => c.status === 'active').length,
    w60: contracts.filter(c => { const d = daysUntil(c.end_date); return d >= 0 && d <= (c.reminder_config.reminder1_days) && d > (c.reminder_config.reminder2_days); }).length,
    w35: contracts.filter(c => { const d = daysUntil(c.end_date); return d >= 0 && d <= (c.reminder_config.reminder2_days) && d > (c.reminder_config.reminder3_days); }).length,
    w7: contracts.filter(c => { const d = daysUntil(c.end_date); return d >= 0 && d <= (c.reminder_config.reminder3_days); }).length,
    expired: contracts.filter(c => c.status === 'expired' || daysUntil(c.end_date) < 0).length,
    renewal: contracts.filter(c => c.status === 'renewal_in_progress').length,
  };

  const handleRenewalDecision = async (contract: Contract, outcome: string) => {
    try {
      await gabahApi.decideContractRenewal(contract.id, outcome, `Keputusan oleh ${currentUser.name}`);
      showToast(`Keputusan renewal ${contract.contract_number} tersimpan.`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan keputusan renewal', 'warning');
    }
  };

  const handleRunSweep = async () => {
    setIsRunningSweep(true);
    try {
      const res = await gabahApi.runContractReminderSweep();
      showToast(`Reminder sweep selesai: ${res.queued} notifikasi diantrikan dari ${res.evaluated} kontrak.`, 'info');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan reminder sweep', 'warning');
    } finally {
      setIsRunningSweep(false);
    }
  };

  const handleShowLogs = async (contract: Contract) => {
    try {
      const logs = await gabahApi.getContractNotificationLogs(contract.id);
      setNotifLogs(prev => ({ ...prev, [contract.id]: logs }));
      setExpandedId(expandedId === contract.id ? null : contract.id);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat log notifikasi', 'warning');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Contract Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Register kontrak lintas divisi — domain tersendiri, bukan kategori helpdesk. Ticket dapat ditautkan untuk tindak lanjut.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleRunSweep}
              disabled={isRunningSweep}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
              title="Evaluasi threshold reminder semua kontrak (idempoten per hari)"
            >
              <BellRing className={`w-4 h-4 text-amber-600 ${isRunningSweep ? 'animate-pulse' : ''}`} />
              Jalankan Reminder Sweep
            </button>
          )}
          <button
            onClick={onCreateContract}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Kontrak Baru
          </button>
        </div>
      </div>

      {/* Dashboard summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Aktif', value: stats.active, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: `≤ ${contracts[0]?.reminder_config?.reminder1_days ?? 60} hari`, value: stats.w60, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: `≤ ${contracts[0]?.reminder_config?.reminder2_days ?? 35} hari`, value: stats.w35, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
          { label: `≤ ${contracts[0]?.reminder_config?.reminder3_days ?? 7} hari`, value: stats.w7, cls: 'text-rose-700 bg-rose-50 border-rose-300' },
          { label: 'Kedaluwarsa', value: stats.expired, cls: 'text-stone-600 bg-stone-100 border-stone-300' },
          { label: 'Renewal Berjalan', value: stats.renewal, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.cls}`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nomor, judul, vendor, PIC…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500"
          />
        </div>
        {[
          { value: deptFilter, set: setDeptFilter, options: ['ALL', 'GA', 'IT', 'SC', 'PIBC'], label: 'Divisi' },
          { value: vendorFilter, set: setVendorFilter, options: ['ALL', ...vendors], label: 'Vendor' },
          { value: typeFilter, set: setTypeFilter, options: ['ALL', ...types], label: 'Tipe' },
          { value: statusFilter, set: setStatusFilter, options: ['ALL', 'draft', 'active', 'expiring', 'renewal_in_progress', 'renewed', 'terminated', 'expired'], label: 'Status' },
        ].map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => f.set(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
          >
            {f.options.map(o => (
              <option key={o} value={o}>{o === 'ALL' ? `${f.label}: Semua` : o}</option>
            ))}
          </select>
        ))}
        <button onClick={onRefresh} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Contract cards */}
      <div className="space-y-3">
        {filtered.map(contract => {
          const rb = reminderBadge(contract);
          const st = STATUS_META[contract.status] || STATUS_META.active;
          const isOpen = expandedId === contract.id;
          const canDecide = (isAdmin || contract.pic_user_id === currentUser.id || contract.owner_division === currentUser.division) && currentUser.role !== 'Auditor';

          return (
            <div key={contract.id} className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-400">{contract.contract_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${st.className}`}>{st.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rb.className}`}>{rb.label}</span>
                      {contract.restricted && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Restricted
                        </span>
                      )}
                      {contract.auto_renewal && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Auto-Renewal</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{contract.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {contract.vendor_name}</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {contract.contract_type}</span>
                      <span>Divisi: <strong className="text-slate-700">{contract.owner_division}</strong></span>
                      <span>PIC: <strong className="text-slate-700">{contract.pic_name}</strong></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Berakhir</div>
                    <div className="text-sm font-black text-slate-900">{formatDate(contract.end_date)}</div>
                    {contract.notice_period_days > 0 && (
                      <div className="text-[10px] text-amber-700 font-semibold">Notice: {formatDate(contract.notice_date)} ({contract.notice_period_days}h)</div>
                    )}
                    {contract.contract_value > 0 && (
                      <div className="text-[11px] text-emerald-700 font-bold mt-0.5">{formatRupiah(contract.contract_value)}</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => handleShowLogs(contract)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-semibold text-slate-700"
                  >
                    <History className="w-3.5 h-3.5" /> Log Notifikasi ({contract.id in notifLogs ? notifLogs[contract.id].length : '…'})
                  </button>
                  {canDecide && (
                    <button
                      onClick={() => onCreateLinkedTicket(contract)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-semibold text-slate-700"
                      title="Buat tiket tindak lanjut yang tertaut ke kontrak ini"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Buat Tiket Terkait
                    </button>
                  )}
                  {canDecide && ['active', 'expiring', 'renewal_in_progress'].includes(contract.status) && (
                    <>
                      <button
                        onClick={() => handleRenewalDecision(contract, 'renewed')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Renewed
                      </button>
                      <button
                        onClick={() => handleRenewalDecision(contract, 'not_renewed')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tidak Diperbarui
                      </button>
                    </>
                  )}
                </div>

                {/* Notification log drawer */}
                {isOpen && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Log Pengiriman Notifikasi</div>
                    {(notifLogs[contract.id] || []).length === 0 && (
                      <div className="text-[11px] text-slate-400">Belum ada reminder yang diantrikan untuk kontrak ini.</div>
                    )}
                    {(notifLogs[contract.id] || []).slice(0, 12).map(l => (
                      <div key={l.id} className="flex items-center justify-between text-[10px] bg-white rounded border border-slate-200 px-2 py-1.5">
                        <span className="font-mono font-bold text-slate-600">{l.notification_type}</span>
                        <span className="uppercase font-bold text-slate-500">{l.channel}</span>
                        <span className="text-slate-500">{l.recipient}</span>
                        <span className={`font-bold ${l.status === 'sent' ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {l.status === 'sent' ? 'SENT' : `FAILED${l.error_message ? '' : ''}`}
                        </span>
                        <span className="text-slate-400">{formatDateTime(l.scheduled_at)}</span>
                      </div>
                    ))}
                    {(notifLogs[contract.id] || []).some(l => l.error_message) && (
                      <div className="text-[10px] text-slate-500 pt-1">
                        Catatan: channel email/telegram tercatat FAILED bila provider belum dikonfigurasi (SMTP_URL / TELEGRAM_BOT_TOKEN). Transport dapat ditambahkan tanpa mengubah logika reminder.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-white border border-slate-200 p-8 space-y-2">
            <CalendarClock className="w-12 h-12 mx-auto text-slate-300" />
            <h4 className="font-bold text-slate-800 text-sm">Belum Ada Kontrak Terdaftar</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Daftarkan kontrak pertama (security, maintenance, supplier, layanan pasar, dll.) beserta PIC dan masa berlakunya.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
