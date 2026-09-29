import React, { useState } from 'react';
import { X, FileText, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../../types';

interface CreateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onCreate: (payload: {
    contract_type: string;
    title: string;
    vendor_name: string;
    owner_division: string;
    pic_user_id: string;
    start_date: string;
    end_date: string;
    notice_period_days: number;
    contract_value: number;
    auto_renewal: boolean;
    restricted: boolean;
    escalation_user_id?: string | null;
    notes?: string;
    status: 'draft' | 'active';
    reminder_config: { reminder1_days: number; reminder2_days: number; reminder3_days: number };
  }) => Promise<void>;
}

/** Divisi pemilik kontrak — bebas per departemen, tidak terbatas GA/IT/SC/PIBC saja. */
const OWNER_DIVISION_OPTIONS = ['GA', 'IT', 'SC', 'PIBC', 'Sekretariat Direksi', 'Humas', 'Komersial', 'Keuangan', 'SDM'];

const CONTRACT_TYPE_PRESETS = ['Security', 'Maintenance', 'Supplier Barang', 'Layanan Pasar', 'Sewa', 'Konsultansi', 'Langganan Layanan', 'Umum'];

export const CreateContractModal: React.FC<CreateContractModalProps> = ({ isOpen, onClose, users, currentUser, onCreate }) => {
  const isAdmin = currentUser.role === 'Admin GABAH';
  const ownDivision = (currentUser.division || 'GA').toUpperCase();

  const [contractType, setContractType] = useState('Umum');
  const [title, setTitle] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [ownerDivision, setOwnerDivision] = useState(ownDivision);
  const [picUserId, setPicUserId] = useState(currentUser.id);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [noticeDays, setNoticeDays] = useState(60);
  const [contractValue, setContractValue] = useState('');
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [escalationUserId, setEscalationUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [r1, setR1] = useState(60);
  const [r2, setR2] = useState(35);
  const [r3, setR3] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const picCandidates = users.filter(u => u.is_active !== false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !vendorName.trim() || !endDate) {
      setError('Judul, vendor, dan tanggal berakhir wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        contract_type: contractType,
        title: title.trim(),
        vendor_name: vendorName.trim(),
        owner_division: ownerDivision,
        pic_user_id: picUserId,
        start_date: startDate,
        end_date: endDate,
        notice_period_days: Number(noticeDays) || 0,
        contract_value: Number(contractValue) || 0,
        auto_renewal: autoRenewal,
        restricted: restricted,
        escalation_user_id: escalationUserId || null,
        notes: notes.trim() || undefined,
        status: 'active',
        reminder_config: { reminder1_days: Number(r1), reminder2_days: Number(r2), reminder3_days: Number(r3) },
      });
      // reset minimal
      setTitle('');
      setVendorName('');
      setEndDate('');
      setContractValue('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan kontrak.');
    } finally {
      setSaving(false);
    }
  };

  const noticeDate = endDate && Number(noticeDays) > 0
    ? new Date(new Date(endDate).getTime() - Number(noticeDays) * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">Daftarkan Kontrak Baru</h3>
              <p className="text-[10px] text-slate-500">Domain Contract Management — record bisnis, bukan tiket helpdesk</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Judul Kontrak *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="PKS Security PT ABC 2026"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Vendor / Pihak Kedua *</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="PT ABC Security Services"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Tipe Kontrak</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRACT_TYPE_PRESETS.map(t => (
                <button key={t} type="button" onClick={() => setContractType(t)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                    contractType === t ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Ownership */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Divisi Pemilik *</label>
              <select value={ownerDivision} onChange={e => setOwnerDivision(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500 disabled:bg-slate-100">
                {Array.from(new Set([ownDivision, ...OWNER_DIVISION_OPTIONS])).map(d => (
                  <option key={d} value={d}>{d}{d === ownDivision ? ' (divisi Anda)' : ''}</option>
                ))}
              </select>
              {!isAdmin && <p className="text-[10px] text-slate-400">Non-admin hanya dapat mendaftarkan kontrak untuk divisinya sendiri.</p>}
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">PIC Kontrak *</label>
              <select value={picUserId} onChange={e => setPicUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500">
                {picCandidates.map(u => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role_label || u.role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Mulai *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Berakhir *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Notice Period (hari)</label>
              <input type="number" min={0} value={noticeDays} onChange={e => setNoticeDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
              {noticeDate && <p className="text-[10px] text-amber-700 font-semibold">Notice date: {noticeDate}</p>}
            </div>
          </div>

          {/* Value & flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Nilai Kontrak (IDR, opsional)</label>
              <input type="number" min={0} value={contractValue} onChange={e => setContractValue(e.target.value)} placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Eskalasi Untuk (35/7 hari)</label>
              <select value={escalationUserId} onChange={e => setEscalationUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500">
                <option value="">— Tidak ada —</option>
                {picCandidates.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={autoRenewal} onChange={e => setAutoRenewal(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Auto Renewal
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} className="w-4 h-4 accent-rose-600" />
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Restricted Access
            </label>
          </div>

          {/* Reminder thresholds (configurable, not hard-coded) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-bold text-slate-700">Threshold Reminder (hari sebelum kedaluwarsa — dapat diubah)</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-amber-700 uppercase">Peringatan 1</label>
                <input type="number" min={1} value={r1} onChange={e => setR1(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-orange-700 uppercase">Peringatan 2</label>
                <input type="number" min={1} value={r2} onChange={e => setR2(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[10px] font-bold text-rose-700 uppercase">Kritis</label>
                <input type="number" min={1} value={r3} onChange={e => setR3(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700">Catatan</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 font-semibold">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50">Batal</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan Kontrak'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
