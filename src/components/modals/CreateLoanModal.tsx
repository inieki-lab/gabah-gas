import React, { useState, useMemo } from 'react';
import { 
  X, 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Building2,
  Tag
} from 'lucide-react';
import { Asset, Loan, UserProfile } from '../../types';
import { GabahService, formatDateTime } from '../../services/gabahService';

interface CreateLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanableAssets?: Asset[];
  assets?: Asset[];
  existingLoans?: Loan[];
  currentUser: UserProfile;
  preselectedAssetId?: string;
  onRequestLoan: (loanData: {
    asset_id: string;
    purpose: string;
    start_date: string;
    due_date: string;
    borrower_phone: string;
  }) => void;
}

export const CreateLoanModal: React.FC<CreateLoanModalProps> = ({
  isOpen,
  onClose,
  loanableAssets,
  assets,
  existingLoans = [],
  currentUser,
  preselectedAssetId,
  onRequestLoan,
}) => {
  // Pool of available assets for loaning
  const availablePool = useMemo(() => {
    if (loanableAssets && Array.isArray(loanableAssets) && loanableAssets.length > 0) {
      return loanableAssets;
    }
    if (assets && Array.isArray(assets) && assets.length > 0) {
      return assets.filter(a => a.is_loanable || a.status === 'available' || a.status === 'assigned');
    }
    return [];
  }, [loanableAssets, assets]);

  // Default pick preselected or first available asset
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    preselectedAssetId || (availablePool.length > 0 ? availablePool[0].id : '')
  );

  // Sync when preselectedAssetId or availablePool changes
  React.useEffect(() => {
    if (preselectedAssetId) {
      setSelectedAssetId(preselectedAssetId);
    } else if (!selectedAssetId && availablePool.length > 0) {
      setSelectedAssetId(availablePool[0].id);
    }
  }, [preselectedAssetId, availablePool, selectedAssetId]);

  // Default tomorrow 09:00 to 17:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(`${tomorrowStr}T09:00`);
  const [dueDate, setDueDate] = useState<string>(`${tomorrowStr}T17:00`);
  const [purpose, setPurpose] = useState<string>('');
  const [borrowerPhone, setBorrowerPhone] = useState<string>('0812-3456-7890');

  // Real-time Schedule Conflict Check
  const conflictCheck = useMemo(() => {
    if (!selectedAssetId || !startDate || !dueDate) {
      return { hasConflict: false };
    }
    return GabahService.checkLoanConflict(selectedAssetId, startDate, dueDate, existingLoans || []);
  }, [selectedAssetId, startDate, dueDate, existingLoans]);

  const selectedAsset = availablePool.find((a) => a.id === selectedAssetId);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictCheck.hasConflict) return;
    if (!selectedAssetId || !purpose.trim()) return;

    onRequestLoan({
      asset_id: selectedAssetId,
      purpose,
      start_date: startDate,
      due_date: dueDate,
      borrower_phone: borrowerPhone,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Pengajuan Peminjaman Barang GABAH</h3>
              <p className="text-xs text-slate-500">Pengecekan ketersediaan jadwal secara real-time</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Pemohon Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Pemohon (Karyawan)</div>
              <div className="font-bold text-slate-900 text-sm">{currentUser.name}</div>
              <div className="text-slate-500">{currentUser.department} ({currentUser.email})</div>
            </div>
            <div className="w-1/3">
              <label className="text-[10px] uppercase font-bold text-slate-600">No. WhatsApp / HP</label>
              <input
                type="text"
                required
                value={borrowerPhone}
                onChange={(e) => setBorrowerPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono mt-0.5 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Pilih Aset Idle */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-bold">Pilih Aset yang Tersedia Dipinjam:</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
            >
              {availablePool.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  [{asset.asset_number}] {asset.name} ({asset.owner_division} - {asset.category_code || asset.category_type})
                </option>
              ))}
            </select>
            {selectedAsset && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono text-emerald-700 font-bold">{selectedAsset.asset_number}</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  Divisi Pemilik: {selectedAsset.owner_division}
                </span>
                {selectedAsset.corporate_asset_number && (
                  <span>• Corp: <span className="font-mono text-slate-700 font-medium">{selectedAsset.corporate_asset_number}</span></span>
                )}
                <span>• Lokasi: {selectedAsset.location}</span>
              </div>
            )}
          </div>

          {/* Tanggal & Waktu Pinjam */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-700 font-bold">Waktu Mulai Pinjam:</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 font-bold">Batas Waktu Pengembalian:</label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* SCHEDULE CONFLICT REAL-TIME STATUS BANNER */}
          {conflictCheck.hasConflict ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                BENTROK JADWAL TERDETEKSI!
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                {conflictCheck.message}
              </p>
              <p className="text-[10px] text-rose-600 pt-1 font-semibold">
                Silakan ubah tanggal/jam peminjaman atau pilih aset idle lainnya.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Jadwal Bebas Bentrok!</strong> Aset ini tersedia pada rentang waktu yang dipilih.
              </span>
            </div>
          )}

          {/* Keperluan Peminjaman */}
          <div className="space-y-1">
            <label className="text-slate-700 font-bold">Tujuan / Keperluan Peminjaman:</label>
            <textarea
              rows={3}
              required
              placeholder="Jelaskan kebutuhan acara, demo produk beras, dinas luar kota, kunjungan pasar, dll..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={conflictCheck.hasConflict}
              className={`px-5 py-2 rounded-xl font-bold transition-all ${
                conflictCheck.hasConflict
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
              }`}
            >
              Ajukan Permohonan Peminjaman
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
