import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, History, Power, RefreshCw, ShieldCheck } from 'lucide-react';
import { gabahApi } from '../../services/gabahApi';
import type { ModuleLifecycleRecord, ModuleStatusAuditRecord } from '../../services/gabahApi';

interface ModuleLifecyclePanelProps {
  showToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  onChanged?: () => Promise<void> | void;
}

export const ModuleLifecyclePanel: React.FC<ModuleLifecyclePanelProps> = ({ showToast, onChanged }) => {
  const [modules, setModules] = useState<ModuleLifecycleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [expandedAuditKey, setExpandedAuditKey] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<Record<string, ModuleStatusAuditRecord[]>>({});
  const [auditLoadingKey, setAuditLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setModules(await gabahApi.getModules());
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat status modul.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const beginToggle = (module: ModuleLifecycleRecord) => {
    setPendingKey(module.module_key);
    setReason('');
  };

  const saveToggle = async (module: ModuleLifecycleRecord) => {
    if (reason.trim().length < 5 || reason.trim().length > 500) {
      showToast('Alasan perubahan wajib 5–500 karakter.', 'warning');
      return;
    }
    setSavingKey(module.module_key);
    try {
      await gabahApi.updateModuleStatus(module.module_key, {
        is_active: !module.is_active,
        reason: reason.trim(),
      });
      setAuditRows(prev => {
        const next = { ...prev };
        delete next[module.module_key];
        return next;
      });
      setPendingKey(null);
      setReason('');
      await refresh();
      await onChanged?.();
      showToast(`Modul ${module.name} berhasil ${module.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal mengubah status modul.', 'warning');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleAudit = async (moduleKey: string) => {
    if (expandedAuditKey === moduleKey) {
      setExpandedAuditKey(null);
      return;
    }
    setExpandedAuditKey(moduleKey);
    if (auditRows[moduleKey]) return;
    setAuditLoadingKey(moduleKey);
    try {
      const rows = await gabahApi.getModuleAudit(moduleKey);
      setAuditRows(prev => ({ ...prev, [moduleKey]: rows }));
    } catch (err: any) {
      showToast(err?.message || 'Gagal memuat histori modul.', 'warning');
    } finally {
      setAuditLoadingKey(null);
    }
  };

  const activeCount = modules.filter(module => module.is_active).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2"><Power className="w-4 h-4 text-emerald-600" /> Siklus Hidup Modul</h3>
          <p className="text-xs text-slate-500 mt-1">Status berlaku global untuk semua pengguna. Hak akses per pegawai tetap mengikuti assignment Dynamic RBAC.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-black text-slate-900">{activeCount}/{modules.length}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Modul aktif</div>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        Menonaktifkan modul tidak menghapus transaksi, master data, atau konfigurasi. API modul akan menolak akses sampai modul diaktifkan kembali. Setiap perubahan wajib disertai alasan dan tercatat pada audit append-only.
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

      <div className="space-y-3">
        {modules.map(module => (
          <div key={module.module_key} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-slate-900">{module.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${module.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {module.is_active ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                  {module.is_system && <span className="text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">Modul sistem</span>}
                </div>
                <p className="text-xs text-slate-600 mt-1">{module.description || 'Tidak ada deskripsi.'}</p>
                <p className="text-[10px] text-slate-400 mt-1">Key: {module.module_key} · Urutan menu: {module.sort_order}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void toggleAudit(module.module_key)} className="px-2.5 py-2 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                  <History className="w-3.5 h-3.5 inline mr-1" /> Histori
                </button>
                <button onClick={() => beginToggle(module)} disabled={savingKey !== null} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${module.is_active ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-50`}>
                  {module.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
              </div>
            </div>

            {pendingKey === module.module_key && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900"><AlertTriangle className="w-4 h-4" /> Konfirmasi perubahan status</div>
                <p className="text-[11px] text-amber-800">Perubahan berlaku global dan akan menolak API modul saat nonaktif. Masukkan alasan yang dapat ditelusuri (5–500 karakter).</p>
                <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-amber-300" placeholder="Contoh: Modul tidak digunakan selama konsolidasi aplikasi booking ruang." />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setPendingKey(null); setReason(''); }} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-white">Batal</button>
                  <button onClick={() => void saveToggle(module)} disabled={savingKey === module.module_key || reason.trim().length < 5} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40">
                    {savingKey === module.module_key ? 'Menyimpan…' : 'Konfirmasi'}
                  </button>
                </div>
              </div>
            )}

            {expandedAuditKey === module.module_key && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Histori status (50 terakhir)</h5>
                {auditLoadingKey === module.module_key ? <p className="text-xs text-slate-500">Memuat histori…</p> : (
                  <div className="space-y-2">
                    {(auditRows[module.module_key] || []).length === 0 && <p className="text-xs text-slate-500">Belum ada perubahan status.</p>}
                    {(auditRows[module.module_key] || []).map(row => (
                      <div key={row.id} className="rounded-lg bg-slate-50 p-2 text-[11px]">
                        <div className="font-bold text-slate-800">{row.previous_is_active ? 'Aktif' : 'Nonaktif'} → {row.new_is_active ? 'Aktif' : 'Nonaktif'}</div>
                        <div className="text-slate-600 mt-0.5">{row.reason}</div>
                        <div className="text-slate-400 mt-0.5">{new Date(row.changed_at).toLocaleString('id-ID')} · {row.changed_by_user_id}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modules.length === 0 && !loading && <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Registry modul belum tersedia.</div>}
    </div>
  );
};
