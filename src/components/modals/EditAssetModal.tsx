import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  User, 
  ShieldCheck, 
  Laptop, 
  Car, 
  KeyRound, 
  Tag, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Sparkles,
  RefreshCw,
  Building,
  UserCheck,
  UserX,
  HelpCircle
} from 'lucide-react';
import { Asset, UserProfile, AssetCondition, AssetStatus } from '../../types';
import { GabahService } from '../../services/gabahService';
import { gabahApi } from '../../services/gabahApi';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  currentUser?: UserProfile;
  users?: UserProfile[];
  allUsers?: UserProfile[];
  allAssets?: Asset[];
  onSaveAsset?: (assetId: string, updates: Partial<Asset>, assignUserId?: string, assignReason?: string) => Promise<void>;
  onSaved?: (asset: Asset) => Promise<void> | void;
  onOpenBastModal?: (asset: Asset, assignedUser?: UserProfile) => void;
}

export const EditAssetModal: React.FC<EditAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  currentUser,
  users = [],
  allUsers = [],
  allAssets = [],
  onSaveAsset,
  onSaved,
  onOpenBastModal,
}) => {
  const activeUsers = (users && users.length > 0) ? users : (allUsers || []);
  // T2B-2: master lokasi fisik aset untuk pemilihan pada form edit.
  const [assetLocations, setAssetLocations] = useState<any[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    gabahApi.getAssetLocations()
      .then(list => { if (alive && Array.isArray(list)) setAssetLocations(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);
  const assetLocationPath = (id: string): string => {
    const byId = new Map<string, any>(assetLocations.map((l: any): [string, any] => [l.id, l]));
    const parts: string[] = [];
    let cursor = byId.get(id);
    for (let i = 0; cursor && i < 16; i++) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    return parts.join(' - ');
  };

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    corporate_asset_number: '',
    location: '',
    asset_location_id: '' as string,
    condition: 'good' as AssetCondition,
    status: 'available' as AssetStatus,
    is_loanable: false,
    specifications: '',
    notes: '',
  });

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assignmentReason, setAssignmentReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        brand: asset.brand || '',
        model: asset.model || '',
        serial_number: asset.serial_number || '',
        corporate_asset_number: asset.corporate_asset_number || '',
        location: asset.location || '',
        asset_location_id: asset.asset_location_id || '',
        condition: asset.condition || 'good',
        status: (asset.status === 'in_use' ? 'assigned' : asset.status) || 'available',
        is_loanable: Boolean(asset.is_loanable),
        specifications: asset.specifications || '',
        notes: asset.notes || '',
      });
      setSelectedUserId(asset.assigned_to?.id || '');
      setAssignmentReason('');
      setErrorMsg(null);
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  // Role authority check
  const isSuperAdmin = currentUser?.role === 'Admin GABAH';
  const isITUser = currentUser?.role === 'IT';
  const isGAUser = currentUser?.role === 'GA';
  const isSCUser = currentUser?.role === 'Supply Chain';

  const isITAsset = asset.owner_division === 'IT' || asset.category_type === 'IT';
  const isGAAsset = asset.owner_division === 'GA' || asset.category_type === 'General';
  const isSCAsset = asset.owner_division === 'SC';

  let canEditThisAsset = false;
  let authorityWarning = '';

  if (isSuperAdmin) {
    canEditThisAsset = true;
  } else if (isITUser) {
    if (isITAsset) {
      canEditThisAsset = true;
    } else {
      canEditThisAsset = false;
      authorityWarning = 'Personel IT hanya berwenang mengedit aset IT (Hardware/Software). Aset GA dan Supply Chain berstatus Read-Only.';
    }
  } else if (isGAUser) {
    if (isGAAsset && !isITAsset) {
      canEditThisAsset = true;
    } else {
      canEditThisAsset = false;
      authorityWarning = 'Semua perangkat IT & Lisensi adalah milik IT. Divisi GA hanya memiliki izin lihat (read-only).';
    }
  } else if (isSCUser) {
    if (isSCAsset) {
      canEditThisAsset = true;
    } else {
      canEditThisAsset = false;
      authorityWarning = 'Personel Supply Chain hanya berwenang mengedit aset Supply Chain (Logistik & Pabrik Cipinang).';
    }
  }

  const handleAutoGenerateFst = () => {
    const auto = GabahService.generateCorporateAssetNumber(allAssets);
    setFormData(prev => ({ ...prev, corporate_asset_number: auto }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditThisAsset) {
      setErrorMsg('Anda tidak memiliki wewenang mengedit aset ini.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updates: Partial<Asset> = {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        serial_number: formData.serial_number.trim(),
        corporate_asset_number: formData.corporate_asset_number.trim() ? formData.corporate_asset_number.trim() : null,
        // T2B-2: relasi lokasi fisik + teks legacy (sinkron bila master dipilih).
        asset_location_id: formData.asset_location_id || null,
        location: (formData.asset_location_id ? assetLocationPath(formData.asset_location_id) : formData.location.trim()) || formData.location.trim(),
        condition: formData.condition,
        is_loanable: formData.is_loanable,
        specifications: formData.specifications.trim(),
        notes: formData.notes.trim(),
        status: selectedUserId ? 'assigned' : formData.status,
      };

      if (onSaveAsset) {
        await onSaveAsset(
          asset.id, 
          updates, 
          selectedUserId !== (asset.assigned_to?.id || '') ? selectedUserId : undefined, 
          assignmentReason.trim()
        );
      } else if (onSaved) {
        await onSaved({ ...asset, ...updates });
      }
      
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan perubahan aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const targetAssignedUser = (activeUsers || []).find(u => u.id === selectedUserId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isITAsset ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isITAsset ? <Laptop className="w-5 h-5" /> : <Car className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Kelola &amp; Edit Aset</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {asset.asset_number}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  asset.owner_division === 'IT' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  Divisi: {asset.owner_division}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {asset.name} • {asset.brand} {asset.model}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Authority Alert if not allowed */}
          {!canEditThisAsset && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Akses Terbatas (Read-Only)</strong>
                <span>{authorityWarning}</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="edit-asset-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Assignment to User (PIC Penugasan) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">
                    Penugasan Pengguna (PIC Karyawan)
                  </h4>
                </div>
                {onOpenBastModal && (asset.assigned_to || selectedUserId) && (
                  <button
                    type="button"
                    onClick={() => onOpenBastModal(asset, targetAssignedUser)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-blue-100/60 text-blue-800 border border-blue-300 text-xs font-bold transition-all shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cetak BAST Penugasan</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pilih Karyawan Penerima Aset
                  </label>
                  <select
                    disabled={!canEditThisAsset || isSubmitting}
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      if (e.target.value) {
                        setFormData(prev => ({ ...prev, status: 'assigned' }));
                      } else {
                        setFormData(prev => ({ ...prev, status: 'available' }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">— Tidak Ada PIC / Idle di Pool Gudang (Tersedia) —</option>
                    {(activeUsers || []).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.department} • {u.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Pilih nama karyawan untuk menugaskan laptop/aset ini secara tetap dengan BAST.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Keperluan / Alasan Penugasan
                  </label>
                  <input
                    type="text"
                    disabled={!canEditThisAsset || isSubmitting}
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                    placeholder="Contoh: Laptop kerja dinas staf akuntansi baru"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Akan dicatat di riwayat mutasi (Asset Movement Log).
                  </p>
                </div>
              </div>

              {/* Status explanation badge */}
              <div className="p-2.5 rounded-lg bg-white/80 border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">Status Aset Setelah Disimpan:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedUserId 
                      ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedUserId ? 'Sedang Digunakan (Assigned / In Use)' : 'Tersedia di Gudang (Available / Idle)'}
                  </span>
                </div>
                {selectedUserId && (
                  <span className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> BAST dapat langsung dicetak
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Peminjaman / Loanable & Status Operasional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              
              {/* Loanable Toggle */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kebijakan Peminjaman (Loanable)
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canEditThisAsset || isSubmitting}
                      checked={formData.is_loanable}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_loanable: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className="text-xs font-bold text-slate-800">
                    {formData.is_loanable ? (
                      <span className="text-emerald-700">Dapat Dipinjam (Masuk Pool Reservasi)</span>
                    ) : (
                      <span className="text-slate-500">Inventaris Tetap (Non-loanable)</span>
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Jika aktif, karyawan dapat mengajukan pinjam pakai laptop/aset ini di menu Peminjaman.
                </p>
              </div>

              {/* Status Operasional */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Status Operasional
                </label>
                <select
                  disabled={!canEditThisAsset || isSubmitting || Boolean(selectedUserId)}
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as AssetStatus }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="available">Tersedia / Idle (Siap Digunakan)</option>
                  <option value="assigned">Digunakan Pegawai (Assigned)</option>
                  <option value="maintenance">Dalam Pemeliharaan / Servis (Maintenance)</option>
                  <option value="retired">Afkir / Hapus Buku (Retired)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {selectedUserId ? 'Otomatis diatur ke Assigned karena ada PIC.' : 'Pilih status ketersediaan barang di gudang.'}
                </p>
              </div>

            </div>

            {/* Section 3: Informasi Utama Aset */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700" />
                Spesifikasi &amp; Identitas Fisik
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Aset <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Merk / Brand
                  </label>
                  <input
                    type="text"
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Model / Tipe
                  </label>
                  <input
                    type="text"
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor Seri (Serial Number)
                  </label>
                  <input
                    type="text"
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.serial_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Nomor Accurate ERP (FST-XX-XXXX)</span>
                    <button
                      type="button"
                      onClick={handleAutoGenerateFst}
                      className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto Sync
                    </button>
                  </label>
                  <input
                    type="text"
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.corporate_asset_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, corporate_asset_number: e.target.value }))}
                    placeholder="FST-24-0010"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Lokasi Penempatan
                  </label>
                  <select
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.asset_location_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        asset_location_id: id,
                        location: id ? assetLocationPath(id) : prev.location,
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">— Di luar master (teks legacy) —</option>
                    {assetLocations.filter((l: any) => l.is_active || l.id === asset.asset_location_id).map((l: any) => (
                      <option key={l.id} value={l.id}>{assetLocationPath(l.id)}{l.is_active ? '' : ' (nonaktif)'}</option>
                    ))}
                  </select>
                  {!formData.asset_location_id && (
                    <input
                      type="text"
                      disabled={!canEditThisAsset || isSubmitting}
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 mt-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  )}
                  {asset.asset_location_id && !formData.asset_location_id && (
                    <p className="text-[10px] text-amber-600 mt-1">Aset ini sebelumnya terpetakan ke master — pilihan "Di luar master" akan melepas relasinya.</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kondisi Fisik
                  </label>
                  <select
                    disabled={!canEditThisAsset || isSubmitting}
                    value={formData.condition}
                    onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value as AssetCondition }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="good">Baik / Prima (Good)</option>
                    <option value="fair">Cukup / Normal (Fair)</option>
                    <option value="poor">Perlu Perhatian (Poor)</option>
                    <option value="damaged">Rusak / Tidak Dapat Digunakan (Damaged)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Spesifikasi Teknis
                </label>
                <textarea
                  rows={2}
                  disabled={!canEditThisAsset || isSubmitting}
                  value={formData.specifications}
                  onChange={(e) => setFormData(prev => ({ ...prev, specifications: e.target.value }))}
                  placeholder="Misal: Processor Intel Core i7, RAM 16GB, SSD 512GB, Windows 11 Pro"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan Internal Pengelola Aset
                </label>
                <textarea
                  rows={2}
                  disabled={!canEditThisAsset || isSubmitting}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Catatan servis, histori pemakaian, dsb."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

          </form>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Hak Akses: <strong>{currentUser?.role || 'Pengguna'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              form="edit-asset-form"
              disabled={!canEditThisAsset || isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Simpan Perubahan &amp; Penugasan</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
