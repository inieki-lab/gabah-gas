import React, { useState, useMemo } from 'react';
import { 
  X, 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Building2,
  Tag,
  Laptop,
  Car,
  Boxes,
  Plus,
  Info,
  Check
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
    asset_ids?: string[];
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
  // Filter available pool of loanable assets
  const availablePool = useMemo(() => {
    if (loanableAssets && Array.isArray(loanableAssets) && loanableAssets.length > 0) {
      return loanableAssets;
    }
    if (assets && Array.isArray(assets) && assets.length > 0) {
      return assets.filter(a => a.is_loanable || a.status === 'available');
    }
    return [];
  }, [loanableAssets, assets]);

  const isAuditor = currentUser?.role === 'Auditor';

  // Selected asset IDs (supports multiple selections, e.g. 1 Laptop IT + 1 Mobil GA)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => {
    if (preselectedAssetId) return [preselectedAssetId];
    if (availablePool.length > 0) return [availablePool[0].id];
    return [];
  });

  // Category filter for convenience
  const [filterDivision, setFilterDivision] = useState<'ALL' | 'IT' | 'GA'>('ALL');

  // Sync preselectedAssetId if opened with specific asset
  React.useEffect(() => {
    if (preselectedAssetId) {
      setSelectedAssetIds(prev => prev.includes(preselectedAssetId) ? prev : [...prev, preselectedAssetId]);
    } else if (selectedAssetIds.length === 0 && availablePool.length > 0) {
      setSelectedAssetIds([availablePool[0].id]);
    }
  }, [preselectedAssetId, availablePool]);

  // Default tomorrow 09:00 to 17:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(`${tomorrowStr}T09:00`);
  const [dueDate, setDueDate] = useState<string>(`${tomorrowStr}T17:00`);
  const [purpose, setPurpose] = useState<string>('');
  const [borrowerPhone, setBorrowerPhone] = useState<string>('');

  // Toggle selection for an asset
  const handleToggleAsset = (id: string) => {
    setSelectedAssetIds(prev => {
      if (prev.includes(id)) {
        // Keep at least one or allow unchecking
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Real-time Schedule Conflict Check for EACH selected asset
  // Note: An asset collision only applies to the EXACT SAME asset_id.
  // Borrowing Laptop IT + Mobil GA at the exact same time is 100% allowed!
  const assetConflictMap = useMemo(() => {
    const map: Record<string, { hasConflict: boolean; message?: string; conflictingLoan?: Loan }> = {};
    if (!startDate || !dueDate) return map;

    selectedAssetIds.forEach(id => {
      map[id] = GabahService.checkLoanConflict(id, startDate, dueDate, existingLoans || []);
    });
    return map;
  }, [selectedAssetIds, startDate, dueDate, existingLoans]);

  const hasAnyConflict = useMemo(() => {
    return Object.values(assetConflictMap).some((res: { hasConflict: boolean }) => res.hasConflict);
  }, [assetConflictMap]);

  const conflictedAssets = useMemo(() => {
    return availablePool.filter(a => selectedAssetIds.includes(a.id) && assetConflictMap[a.id]?.hasConflict);
  }, [availablePool, selectedAssetIds, assetConflictMap]);

  // Assets filtered by division tab
  const displayedPool = useMemo(() => {
    if (filterDivision === 'ALL') return availablePool;
    return availablePool.filter(a => a.owner_division === filterDivision || (filterDivision === 'IT' && a.category_type === 'IT'));
  }, [availablePool, filterDivision]);

  // Count by division among selected
  const selectedCounts = useMemo(() => {
    const itCount = availablePool.filter(a => selectedAssetIds.includes(a.id) && (a.owner_division === 'IT' || a.category_type === 'IT')).length;
    const gaCount = availablePool.filter(a => selectedAssetIds.includes(a.id) && (a.owner_division === 'GA' || a.category_type === 'GA')).length;
    return { it: itCount, ga: gaCount, total: selectedAssetIds.length };
  }, [availablePool, selectedAssetIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuditor || hasAnyConflict) return;
    if (selectedAssetIds.length === 0 || !purpose.trim()) return;

    onRequestLoan({
      asset_id: selectedAssetIds[0],
      asset_ids: selectedAssetIds,
      purpose: purpose.trim(),
      start_date: startDate,
      due_date: dueDate,
      borrower_phone: borrowerPhone.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Pengajuan Peminjaman Barang GABAH</h3>
              <p className="text-xs text-slate-500">Bisa pinjam Laptop (IT) &amp; Mobil (GA) di waktu bersamaan (persetujuan terpisah)</p>
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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Pemohon (Karyawan)</div>
              <div className="font-bold text-slate-900 text-sm">{currentUser.name}</div>
              <div className="text-slate-500">{currentUser.department} • {currentUser.email}</div>
            </div>
            <div className="sm:w-1/3">
              <label className="text-[10px] uppercase font-bold text-slate-600">No. WhatsApp / HP</label>
              <input
                type="text"
                required
                value={borrowerPhone}
                onChange={(e) => setBorrowerPhone(e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono mt-0.5 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Section: Pilih Barang Pinjaman (Multi-Asset Selection) */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  Pilih Aset yang Ingin Dipinjam:
                </label>
                <p className="text-[11px] text-slate-500">
                  Centang satu atau beberapa barang (misal: Laptop IT + Mobil Operasional GA).
                </p>
              </div>

              {/* Filter owner domain aset; lokasi fisik ditampilkan pada detail aset, bukan sebagai owner. */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFilterDivision('ALL')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    filterDivision === 'ALL' ? 'bg-white text-emerald-800 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({availablePool.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDivision('IT')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    filterDivision === 'IT' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  IT / Laptop
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDivision('GA')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    filterDivision === 'GA' ? 'bg-white text-amber-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  GA / Mobil
                </button>
            <button
              type="submit"
              disabled={isAuditor || hasAnyConflict || selectedAssetIds.length === 0}
              className={`px-5 py-2 rounded-xl font-bold transition-all ${
                hasAnyConflict || selectedAssetIds.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
              }`}
            >
              {selectedAssetIds.length > 1
                ? `Ajukan Peminjaman (${selectedAssetIds.length} Barang Sekaligus)`
                : 'Ajukan Permohonan Peminjaman'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
