import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  Tag, 
  QrCode, 
  CalendarClock, 
  LifeBuoy, 
  ShieldCheck, 
  Laptop, 
  Car, 
  KeyRound, 
  Wrench, 
  DollarSign,
  Calculator,
  User,
  Edit2,
  Check,
  Sparkles,
  Copy,
  Lock,
  Truck,
  Building2,
  FileText,
  Scale,
  Info
} from 'lucide-react';
import { Asset, UserProfile, Loan, Ticket } from '../../types';
import { formatRupiah, formatDate, formatDateTime, calculateDepreciation, GabahService } from '../../services/gabahService';

interface AssetDetailModalProps {
  asset: Asset | null;
  onClose: () => void;
  onOpenQrModal: (asset: Asset) => void;
  onLoanThisAsset: (asset: Asset) => void;
  onReportThisAsset: (asset: Asset) => void;
  onUpdateAsset?: (asset: Asset) => void;
  onOpenBastModal?: (asset: Asset) => void;
  onEditThisAsset?: (asset: Asset) => void;
  currentUser?: UserProfile;
  allAssets?: Asset[];
  assetLoans?: Loan[];
  assetTickets?: Ticket[];
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  onClose,
  onOpenQrModal,
  onLoanThisAsset,
  onReportThisAsset,
  onUpdateAsset,
  onOpenBastModal,
  onEditThisAsset,
  currentUser,
  allAssets = [],
  assetLoans = [],
  assetTickets = [],
}) => {
  const [isEditingCorpNumber, setIsEditingCorpNumber] = useState(false);
  const [editedCorpNumber, setEditedCorpNumber] = useState('');
  const [copiedAssetNumber, setCopiedAssetNumber] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'financials' | 'maintenance' | 'history'>('overview');

  const handleCopyAssetNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedAssetNumber(true);
    setTimeout(() => setCopiedAssetNumber(false), 2000);
  };

  useEffect(() => {
    if (asset) {
      setEditedCorpNumber(asset.corporate_asset_number || '');
      setIsEditingCorpNumber(false);
    }
  }, [asset]);

  if (!asset) return null;

  // Freshservice Asset Lifecycle State Machine
  const currentStep = 
    asset.status === 'retired' ? 5 :
    asset.status === 'maintenance' ? 4 :
    asset.status === 'in_use' ? 3 :
    asset.status === 'available' ? 2 : 1;

  const lifecycleSteps = [
    { step: 1, label: 'Pengadaan', desc: formatDate(asset.purchase_date) },
    { step: 2, label: 'Tersedia', desc: asset.status === 'available' ? 'Stok Aktif' : 'Tersedia' },
    { step: 3, label: 'Digunakan', desc: asset.assigned_to ? asset.assigned_to.name : (asset.status === 'in_use' ? 'In Use' : '-') },
    { step: 4, label: 'Servis', desc: asset.status === 'maintenance' ? 'Dalam Perbaikan' : 'Pemeliharaan' },
    { step: 5, label: 'Afkir', desc: asset.status === 'retired' ? 'Hapus Buku' : 'Aktif' },
  ];

  const ownerDivision = asset.owner_division || (asset.asset_number ? asset.asset_number.split('-')[0] : 'GA');
  const isSC = ownerDivision === 'SC' || ownerDivision === 'Supply Chain';
  const isPIBC = ownerDivision === 'PIBC';
  const isIT = ownerDivision === 'IT' || asset.category_type === 'IT';
  const isGA = ownerDivision === 'GA' || (!isSC && !isPIBC && !isIT);
  const isLicense = asset.category_type === 'License' || asset.category_code === 'SLIC' || asset.asset_number?.includes('-SLIC-');
  const canEdit = currentUser ? GabahService.canEditAsset(currentUser, asset) : false;

  let ownershipRuleText = '';
  if (asset.category_code === 'INV-F' || asset.asset_number?.includes('-INV-F-')) {
    ownershipRuleText = 'Semua perabotan/furniture adalah aset GA di manapun penempatannya.';
  } else if (isIT || asset.category_code?.startsWith('IT') || isLicense) {
    ownershipRuleText = 'Semua hardware & lisensi adalah aset milik IT (GA hanya memiliki hak lihat / read-only).';
  } else if (isSC) {
    ownershipRuleText = 'Aset logistik, pergudangan modern & rice milling plant Food Station.';
  } else if (isPIBC) {
    ownershipRuleText = 'Aset dan fasilitas operasional Pasar Induk Beras Cipinang (timbangan & tera sah).';
  } else {
    ownershipRuleText = 'Aset operasional umum di bawah pembinaan General Affairs.';
  }

  const depreciation = calculateDepreciation(asset);

  const handleSaveCorpNumber = () => {
    if (onUpdateAsset) {
      onUpdateAsset({
        ...asset,
        corporate_asset_number: editedCorpNumber.trim() ? editedCorpNumber.trim() : null,
      });
    }
    setIsEditingCorpNumber(false);
  };

  const handleAutoFillFst = () => {
    const auto = GabahService.generateCorporateAssetNumber(allAssets);
    setEditedCorpNumber(auto);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isIT ? 'bg-blue-100 text-blue-700' :
              isSC ? 'bg-emerald-100 text-emerald-700' :
              isPIBC ? 'bg-purple-100 text-purple-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {isIT && <Laptop className="w-5 h-5" />}
              {isSC && <Truck className="w-5 h-5" />}
              {isPIBC && <Scale className="w-5 h-5" />}
              {isGA && <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">{asset.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isIT ? 'bg-blue-50 text-blue-800 border-blue-200' :
                  isSC ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  isPIBC ? 'bg-purple-50 text-purple-800 border-purple-200' :
                  'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  Devisi {ownerDivision} • {asset.category_code || asset.category_type}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{asset.brand} • {asset.model}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          
          {/* Corporate Rule Callout Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-[11px] text-slate-600">
              <strong className="text-slate-900">Kaidah Kepemilikan Korporat:</strong> {ownershipRuleText}
            </div>
          </div>

          {/* Freshservice ITAM Lifecycle Visual Stepper */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700">
                Siklus Hidup Aset (ITAM Lifecycle Pipeline)
              </span>
              <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                Tahap {currentStep} dari 5
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center relative">
              {lifecycleSteps.map((stepItem) => {
                const isPassed = stepItem.step < currentStep;
                const isCurrent = stepItem.step === currentStep;

                return (
                  <div key={stepItem.step} className="flex flex-col items-center space-y-1 z-10">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs ${
                      isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 font-black scale-105'
                        : isPassed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-white text-slate-400 border border-slate-200'
                    }`}>
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : stepItem.step}
                    </div>
                    <div>
                      <div className={`text-[10px] font-bold truncate ${
                        isCurrent ? 'text-emerald-800' : isPassed ? 'text-slate-700' : 'text-slate-400'
                      }`}>
                        {stepItem.label}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate max-w-[70px] mx-auto">
                        {stepItem.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Freshservice Detail Tabs Navigation */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-1">
            <button
              onClick={() => setActiveDetailTab('overview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeDetailTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Identitas &amp; Pengguna
            </button>
            <button
              onClick={() => setActiveDetailTab('financials')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeDetailTab === 'financials'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Finansial &amp; PSAK 16
            </button>
            <button
              onClick={() => setActiveDetailTab('maintenance')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeDetailTab === 'maintenance'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Log Servis &amp; Pemeliharaan
            </button>
            <button
              onClick={() => setActiveDetailTab('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeDetailTab === 'history'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Riwayat Lengkap
            </button>
          </div>

          {/* Tab 1: Identitas & Pengguna */}
          {activeDetailTab === 'overview' && (
            <div className="space-y-4">
              {/* Dual Asset Numbering Visual Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-600" /> Asset Number (Official)
                    </div>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5 text-slate-500" /> Readonly
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div 
                      id="asset-detail-number-display"
                      className="flex-1 font-mono text-base font-black text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm flex items-center justify-between"
                    >
                      <span>{asset.asset_number}</span>
                    </div>
                    <button
                      type="button"
                      id="btn-copy-asset-detail-number"
                      onClick={() => handleCopyAssetNumber(asset.asset_number)}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 transition-colors flex items-center justify-center"
                      title="Copy Nomor Aset"
                    >
                      {copiedAssetNumber ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Format resmi: <code className="font-bold text-slate-700">&#123;DIVISI&#125;-&#123;KODE&#125;-&#123;TAHUN&#125;-&#123;URUT&#125;</code> (Divisi Pemilik: <strong className="text-emerald-700">{asset.owner_division}</strong>)
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-blue-600" /> Corporate Asset Number (Accurate)
                    </div>
                    {canEdit && !isEditingCorpNumber && (
                      <button
                        onClick={() => setIsEditingCorpNumber(true)}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      >
                        <Edit2 className="w-3 h-3" /> Edit/Sync
                      </button>
                    )}
                  </div>

                  {isEditingCorpNumber ? (
                    <div className="mt-1.5 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editedCorpNumber}
                          onChange={(e) => setEditedCorpNumber(e.target.value)}
                          placeholder="FST-24-XXXX"
                          className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-mono text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAutoFillFst}
                          title="Generate FST Sequence"
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCorpNumber}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedCorpNumber(asset.corporate_asset_number || '');
                            setIsEditingCorpNumber(false);
                          }}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px]"
                        >
                          Batal
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Format ERP Accurate: <span className="font-mono font-bold">FST-XX-XXXX</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-base font-bold text-slate-900 mt-1">
                        {asset.corporate_asset_number || (
                          <span className="text-slate-400 font-normal italic text-xs">
                            Non-Corporate / Belum Disinkron
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Nomor aktiva tetap Accurate ERP (format FST-XX-XXXX).
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Asset Specs & Properties */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Spesifikasi &amp; Identitas Fisik
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div><strong>Serial Number:</strong> <span className="font-mono text-emerald-700 font-bold">{asset.serial_number}</span></div>
                  <div><strong>Kondisi:</strong> <span className="capitalize">{asset.condition}</span></div>
                  <div><strong>Status Saat Ini:</strong> <span className="capitalize font-bold text-slate-900">{asset.status}</span></div>
                  <div><strong>Lokasi Penempatan:</strong> {asset.location}</div>
                </div>
                <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                  <strong>Deskripsi:</strong> {asset.specifications}
                </div>
              </div>

              {/* Assigned PIC if any or Unassigned Callout */}
              {asset.assigned_to ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Pengguna Terdaftar (PIC)</div>
                      <div className="font-bold text-slate-900 text-xs">{asset.assigned_to.name}</div>
                      <div className="text-[11px] text-slate-500">{asset.assigned_to.department} • {asset.assigned_to.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenBastModal && (
                      <button
                        type="button"
                        onClick={() => onOpenBastModal(asset)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Cetak BAST</span>
                      </button>
                    )}
                    {onEditThisAsset && (currentUser?.role === 'Admin GABAH' || currentUser?.role === 'IT' || currentUser?.role === 'GA' || currentUser?.role === 'Supply Chain') && (
                      <button
                        type="button"
                        onClick={() => onEditThisAsset(asset)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ubah / Lepas</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-800">Status Penugasan Karyawan</div>
                      <div className="font-bold text-slate-900 text-xs">Belum Ditugaskan (Aset Tersedia di Pool Gudang)</div>
                      <div className="text-[11px] text-slate-600">Aset siap ditugaskan secara manual ke karyawan Food Station.</div>
                    </div>
                  </div>
                  {onEditThisAsset && (currentUser?.role === 'Admin GABAH' || currentUser?.role === 'IT' || currentUser?.role === 'GA' || currentUser?.role === 'Supply Chain') && (
                    <button
                      type="button"
                      onClick={() => onEditThisAsset(asset)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Tugaskan ke Pegawai</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Finansial & PSAK 16 */}
          {activeDetailTab === 'financials' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Finansial &amp; Garansi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div><strong>Harga Perolehan:</strong> {formatRupiah(asset.purchase_price)}</div>
                  <div><strong>Tanggal Beli:</strong> {formatDate(asset.purchase_date)}</div>
                  <div><strong>Garansi Hingga:</strong> {formatDate(asset.warranty_until)}</div>
                  <div>
                    <strong>Peminjaman:</strong>{' '}
                    {asset.is_loanable ? (
                      <span className="text-emerald-700 font-bold">Dapat dipinjam (Aset Idle / Reservasi)</span>
                    ) : (
                      <span className="text-slate-500">Aset Tetap (Non-loanable)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Depresiasi Nilai Buku (PSAK 16 - Straight Line) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    Kalkulasi Penyusutan &amp; Nilai Buku (PSAK 16 - Garis Lurus)
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    Umur: {depreciation.usefulLifeYears} Tahun ({depreciation.usefulLifeMonths} Bln)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Nilai Buku Bersih</div>
                    <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
                      {formatRupiah(depreciation.netBookValue)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Akumulasi Penyusutan</div>
                    <div className="text-sm font-extrabold text-rose-600 mt-0.5">
                      {formatRupiah(depreciation.accumulatedDepreciation)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Penyusutan / Bulan</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {formatRupiah(depreciation.monthlyDepreciation)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <div className="text-slate-500 text-[10px]">Masa Pakai Berjalan</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {depreciation.elapsedMonths} Bln ({depreciation.depreciationPercentage}%)
                    </div>
                  </div>
                </div>

                {/* Progress Bar Penyusutan */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Rasio Penyusutan Berjalan</span>
                    <span>Sisa Umur: {depreciation.remainingMonths} Bulan</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        depreciation.depreciationPercentage > 80 ? 'bg-rose-500' :
                        depreciation.depreciationPercentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${depreciation.depreciationPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Log Servis & Pemeliharaan */}
          {activeDetailTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  Riwayat Servis &amp; Maintenance Log
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">Inspeksi Rutin &amp; Pembersihan Internal</div>
                      <div className="text-[10px] text-slate-500">Teknisi: Tim Internal IT • Status: Baik</div>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold">15 Jul 2026</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">Pembaruan Firmware &amp; Kalibrasi Sistem</div>
                      <div className="text-[10px] text-slate-500">Vendor: PT Mitra Solusi • Biaya: Rp 0 (Garansi)</div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">10 Jan 2026</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Timeline Riwayat Lengkap (Snipe-IT style) */}
          {activeDetailTab === 'history' && (() => {
            type HistoryEntry = {
              kind: 'creation' | 'loan' | 'ticket';
              date: number;
              title: string;
              subtitle: string;
              meta: string;
              tone: string;
              icon: React.ComponentType<{ className?: string }>;
            };

            const entries: HistoryEntry[] = [];

            entries.push({
              kind: 'creation',
              date: new Date(asset.created_at || asset.purchase_date || Date.now()).getTime(),
              title: 'Aset didaftarkan ke sistem',
              subtitle: `Nomor kanonikal ${asset.asset_number} • Divisi pemilik ${asset.owner_division}`,
              meta: `Perolehan: ${formatDate(asset.purchase_date)}${asset.purchase_price ? ` • Nilai: ${formatRupiah(asset.purchase_price)}` : ''}`,
              tone: 'bg-emerald-100 text-emerald-700',
              icon: Sparkles,
            });

            assetLoans.forEach(loan => {
              const badge = GabahService.getLoanStatusBadge(loan.status);
              entries.push({
                kind: 'loan',
                date: new Date(loan.created_at || loan.start_date).getTime(),
                title: `Peminjaman ${loan.loan_number} — ${badge.label}`,
                subtitle: `Peminjam: ${loan.borrower_name} (${loan.borrower_department})`,
                meta: `${formatDateTime(loan.start_date)} → ${formatDateTime(loan.due_date)}${loan.rejection_reason ? ` • Alasan tolak: ${loan.rejection_reason}` : ''}`,
                tone: 'bg-indigo-100 text-indigo-700',
                icon: CalendarClock,
              });
            });

            assetTickets.forEach(t => {
              entries.push({
                kind: 'ticket',
                date: new Date(t.created_at || Date.now()).getTime(),
                title: `Tiket ${t.ticket_number || t.id} — ${t.title}`,
                subtitle: `Pelapor: ${t.reporter_name} • Kategori ${t.category} • Prioritas ${t.priority}`,
                meta: `Status: ${t.status.replace('_', ' ')} • SLA ${t.sla_hours} jam`,
                tone: 'bg-rose-100 text-rose-700',
                icon: LifeBuoy,
              });
            });

            entries.sort((a, b) => b.date - a.date);

            return (
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    Timeline Riwayat Aset ({entries.length} peristiwa)
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Rekap kronologis: pendaftaran, peminjaman, dan tiket gangguan yang terkait aset ini.
                  </p>
                </div>

                {entries.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">Belum ada aktivitas tercatat.</div>
                )}

                <div className="relative pl-6">
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" aria-hidden="true" />
                  {entries.map((e, i) => {
                    const Icon = e.icon;
                    return (
                      <div key={`${e.kind}-${i}`} className="relative pb-4 last:pb-0">
                        <span className={`absolute -left-[22px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${e.tone}`}>
                          <Icon className="w-3 h-3" />
                        </span>
                        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 leading-tight">{e.title}</div>
                            <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">{formatDateTime(new Date(e.date).toISOString())}</span>
                          </div>
                          <div className="text-[11px] text-slate-600">{e.subtitle}</div>
                          <div className="text-[10px] text-slate-500">{e.meta}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenQrModal(asset)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                Cetak Label QR
              </button>

              {onOpenBastModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBastModal(asset);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition-colors"
                  title="Cetak Berita Acara Serah Terima (BAST)"
                >
                  <FileText className="w-4 h-4" />
                  Cetak BAST
                </button>
              )}

              {onEditThisAsset && (currentUser?.role === 'Admin GABAH' || currentUser?.role === 'IT' || currentUser?.role === 'GA' || currentUser?.role === 'Supply Chain') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditThisAsset(asset);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition-colors"
                  title="Edit Aset / Tugaskan Pengguna"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit &amp; Tugaskan
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentUser?.role !== 'Auditor' && (
                <button
                  onClick={() => {
                    onClose();
                    onReportThisAsset(asset);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition-colors"
                >
                  <LifeBuoy className="w-4 h-4" />
                  Laporkan Kendala
                </button>
              )}

              {asset.is_loanable && currentUser?.role !== 'Auditor' && (
                <button
                  onClick={() => {
                    onClose();
                    onLoanThisAsset(asset);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-xs"
                >
                  <CalendarClock className="w-4 h-4" />
                  Reservasi Peminjaman
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
