import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  QrCode, 
  Filter, 
  Laptop, 
  Car, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  Info, 
  ExternalLink, 
  Tag, 
  Eye, 
  SlidersHorizontal, 
  ChevronRight,
  ScanLine,
  FileSpreadsheet,
  Truck,
  Printer,
  Pencil
} from 'lucide-react';
import { Asset, AssetCategoryType, AssetStatus, UserProfile } from '../../types';
import { GabahService, formatRupiah, formatDate, exportAssetsToCsv } from '../../services/gabahService';
import { BatchQRPrintModal } from '../modals/BatchQRPrintModal';

interface AssetsViewProps {
  assets: Asset[];
  currentUser: UserProfile;
  onOpenCreateModal?: () => void;
  onOpenNewAssetModal?: () => void;
  onSelectAsset: (asset: Asset) => void;
  onEditAsset?: (asset: Asset) => void;
  onOpenQrModal: (asset: Asset) => void;
  onOpenScannerModal?: () => void;
  onLoanAsset?: (asset: Asset) => void;
  onReportAsset?: (asset: Asset) => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({
  assets = [],
  currentUser,
  onOpenCreateModal,
  onOpenNewAssetModal,
  onSelectAsset,
  onEditAsset,
  onOpenQrModal,
  onOpenScannerModal = () => {},
  onLoanAsset,
  onReportAsset,
}) => {
  const handleOpenCreate = onOpenCreateModal || onOpenNewAssetModal || (() => {});
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isBatchQrOpen, setIsBatchQrOpen] = useState<boolean>(false);

  const safeAssets = Array.isArray(assets) ? assets : [];

  const filteredAssets = useMemo(() => {
    return safeAssets.filter(asset => {
      // Division filter
      if (selectedDivision !== 'ALL') {
        const div = asset.owner_division || (asset.asset_number ? asset.asset_number.split('-')[0] : '');
        if (selectedDivision === 'SC') {
          if (div !== 'SC' && div !== 'Supply Chain') return false;
        } else if (selectedDivision === 'PIBC') {
          if (div !== 'PIBC') return false;
        } else if (selectedDivision === 'IT') {
          if (div !== 'IT') return false;
        } else if (selectedDivision === 'GA') {
          if (div !== 'GA') return false;
        }
      }

      // Taxonomy / Category filter
      if (selectedCategory !== 'ALL') {
        const code = asset.category_code || '';
        const num = asset.asset_number || '';
        const name = (asset.name || '').toLowerCase();
        
        if (selectedCategory === 'IT-H') {
          const isITH = code === 'IT-H' || ['HLT','HPC','HSV','HWS','HMON','HPRN','HSCN','HNET','HFW','HSTG','HUPS','HRCK'].includes(code) || num.includes('-HLT-') || num.includes('-HPC-') || num.includes('-HSV-') || num.includes('-HMON-') || num.includes('-HNET-') || num.includes('-IT-H-');
          if (!isITH) return false;
        } else if (selectedCategory === 'IT-S') {
          const isITS = code === 'IT-S' || code === 'SLIC' || asset.category_type === 'License' || num.includes('-SLIC-') || num.includes('-IT-S-');
          if (!isITS) return false;
        } else if (selectedCategory === 'INV-F') {
          const isInvF = code === 'INV-F' || num.includes('-INV-F-') || name.includes('meja') || name.includes('kursi') || name.includes('lemari');
          if (!isInvF) return false;
        } else if (selectedCategory === 'INV-P') {
          const isInvP = code === 'INV-P' || num.includes('-INV-P-') || name.includes('kompor') || name.includes('dispenser') || name.includes('ac') || name.includes('apar');
          if (!isInvP) return false;
        } else if (selectedCategory === 'KDR') {
          const isKdr = code.startsWith('KDR') || num.includes('-KDR-') || name.includes('avanza') || name.includes('truk') || name.includes('motor') || name.includes('mobil');
          if (!isKdr) return false;
        } else if (selectedCategory === 'MSN') {
          const isMsn = code.startsWith('MSN') || num.includes('-MSN-') || name.includes('mesin') || name.includes('forklift') || name.includes('timbang');
          if (!isMsn) return false;
        } else if (selectedCategory === 'BGN') {
          const isBgn = code.startsWith('BGN') || num.includes('-BGN-') || name.includes('gedung') || name.includes('gudang') || name.includes('bangunan');
          if (!isBgn) return false;
        } else if (selectedCategory === 'TNH') {
          const isTnh = code.startsWith('TNH') || num.includes('-TNH-') || name.includes('tanah') || name.includes('lahan');
          if (!isTnh) return false;
        } else if (selectedCategory === 'LNY') {
          const isLny = code === 'LNY' || num.includes('-LNY-');
          if (!isLny) return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'available') {
          if (asset.status !== 'available') return false;
        } else if (selectedStatus === 'in_use') {
          if (asset.status !== 'in_use' && asset.status !== 'assigned' && asset.status !== 'active') return false;
        } else if (selectedStatus === 'loaned') {
          if (asset.status !== 'loaned') return false;
        } else if (selectedStatus === 'maintenance') {
          if (asset.status !== 'maintenance' && asset.status !== 'in_repair' && asset.status !== 'damaged') return false;
        } else if (asset.status !== selectedStatus) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(query);
        const matchAssetNum = asset.asset_number.toLowerCase().includes(query);
        const matchCorp = asset.corporate_asset_number?.toLowerCase().includes(query) || false;
        const matchSerial = asset.serial_number?.toLowerCase().includes(query) || false;
        const matchModel = asset.model?.toLowerCase().includes(query) || false;
        const matchLocation = asset.location?.toLowerCase().includes(query) || false;
        return matchName || matchAssetNum || matchCorp || matchSerial || matchModel || matchLocation;
      }
      return true;
    });
  }, [safeAssets, selectedDivision, selectedCategory, selectedStatus, searchQuery]);

  const canCreateAsset = currentUser.role === 'Admin GABAH' || currentUser.role === 'IT' || currentUser.role === 'GA' || currentUser.role === 'Supply Chain' || currentUser.role === 'PIBC';

  return (
    <div className="space-y-6">
      
      {/* Header & Concept Explanation Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Manajemen Aset Korporat &amp; Inventaris
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan aset IT, General Affairs, armada operasional, dan lisensi software enterprise.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenScannerModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 text-xs font-bold transition-all shadow-xs"
            title="Buka Kamera / Barcode Gun Scanner untuk Stock Opname Cepat"
          >
            <ScanLine className="w-4 h-4 text-emerald-600" />
            <span>Scan Barcode / QR</span>
          </button>

          <button
            onClick={() => setIsBatchQrOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Cetak Lembar Stiker Barcode & QR Code A4 untuk Labeling Aset"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Cetak Stiker QR (Sheet)</span>
          </button>

          <button
            onClick={() => exportAssetsToCsv(assets)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-xs"
            title="Download CSV Master Aset untuk Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {canCreateAsset && (
            <button
              id="btn-add-asset"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Aset Baru
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor aset (IT-HLT-2026-0001), Corporate (FST-), nama aset, serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
            />
          </div>

          {/* Division Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-500 px-2 shrink-0">Devisi:</span>
            {[
              { id: 'ALL', label: 'Semua Devisi' },
              { id: 'IT', label: 'IT' },
              { id: 'GA', label: 'GA' },
              { id: 'SC', label: 'SC' },
              { id: 'PIBC', label: 'PIBC' },
            ].map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDivision(d.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedDivision === d.id ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

        </div>

        {/* Jenis Aset Tetap Row */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-xs overflow-x-auto">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1 text-[11px]">
            <Tag className="w-3 h-3" /> Jenis Aset:
          </span>
          {[
            { id: 'ALL', label: 'Semua Jenis' },
            { id: 'IT-H', label: 'IT-H (Hardware)' },
            { id: 'IT-S', label: 'IT-S (Software/Lisensi)' },
            { id: 'INV-F', label: 'INV-F (Furniture GA)' },
            { id: 'INV-P', label: 'INV-P (Peralatan)' },
            { id: 'KDR', label: 'KDR (Kendaraan)' },
            { id: 'MSN', label: 'MSN (Mesin)' },
            { id: 'BGN', label: 'BGN (Bangunan)' },
            { id: 'TNH', label: 'TNH (Tanah)' },
            { id: 'LNY', label: 'LNY (Lainnya)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 hover:bg-slate-200 text-slate-600 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Filter Row */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs overflow-x-auto">
          <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {[
            { id: 'ALL', label: 'Semua Status', count: assets.length },
            { id: 'available', label: 'Tersedia', count: assets.filter(a => a.status === 'available').length },
            { id: 'in_use', label: 'Digunakan / Ditugaskan', count: assets.filter(a => a.status === 'in_use' || a.status === 'assigned' || a.status === 'active').length },
            { id: 'loaned', label: 'Dipinjam', count: assets.filter(a => a.status === 'loaned').length },
            { id: 'maintenance', label: 'Maintenance / Servis', count: assets.filter(a => a.status === 'maintenance' || a.status === 'in_repair' || a.status === 'damaged').length },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedStatus(item.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                selectedStatus === item.id 
                  ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300' 
                  : 'text-slate-600 hover:text-slate-900 bg-slate-50 border border-transparent'
              }`}
            >
              <span>{item.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                selectedStatus === item.id ? 'bg-emerald-200/70 text-emerald-900' : 'bg-slate-200 text-slate-600'
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Assets Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="px-4 py-3.5">Nomor Aset &amp; Kode Label</th>
                <th className="px-4 py-3.5">Nama &amp; Spesifikasi</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5">Lokasi / Pengguna</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Peminjaman</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                const isIT = asset.category_type === 'IT';
                const isGA = asset.category_type === 'General';
                const isLicense = asset.category_type === 'License';

                return (
                  <tr 
                    key={asset.id} 
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectAsset(asset)}
                  >
                    
                    {/* Dual Asset Numbering */}
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded w-fit text-[11px]">
                          {asset.asset_number}
                        </span>
                        {asset.corporate_asset_number ? (
                          <span className="font-mono text-slate-700 text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded w-fit">
                            Corp: {asset.corporate_asset_number}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Non-Corporate (Internal)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name & Specifications */}
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition-colors">
                        {asset.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {asset.brand} • {asset.model}
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-mono">
                        S/N: {asset.serial_number}
                      </div>
                    </td>

                    {/* Category Type */}
                    <td className="px-4 py-3.5 align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isIT ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        isGA ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {isIT && <Laptop className="w-3 h-3" />}
                        {isGA && <Car className="w-3 h-3" />}
                        {isLicense && <KeyRound className="w-3 h-3" />}
                        {asset.category_type} • {asset.subcategory}
                      </span>
                    </td>

                    {/* Location / User */}
                    <td className="px-4 py-3.5 align-top">
                      <div className="text-slate-800 font-medium text-[11px]">{asset.location}</div>
                      {asset.assigned_to && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                          PIC: {asset.assigned_to.name} ({asset.assigned_to.department})
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        asset.status === 'available' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        asset.status === 'in_use' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        asset.status === 'loaned' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {asset.status === 'available' && <CheckCircle2 className="w-3 h-3" />}
                        {asset.status === 'in_use' && <CheckCircle2 className="w-3 h-3" />}
                        {asset.status === 'loaned' && <Clock className="w-3 h-3" />}
                        {asset.status === 'maintenance' && <Wrench className="w-3 h-3" />}
                        {asset.status}
                      </span>
                    </td>

                    {/* Can be borrowed */}
                    <td className="px-4 py-3.5 align-top">
                      {asset.is_loanable ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Bisa Dipinjam
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Aset Tetap
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditAsset && (currentUser?.role === 'Admin GABAH' || currentUser?.role === 'IT' || currentUser?.role === 'GA' || currentUser?.role === 'Supply Chain') && (
                          <button
                            onClick={() => onEditAsset(asset)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors"
                            title="Edit Aset / Penugasan Pegawai"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenQrModal(asset)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-emerald-700 transition-colors"
                          title="Cetak Label QR Barcode"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectAsset(asset)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="Lihat Detail Aset"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Tidak ada aset yang sesuai dengan kriteria filter atau pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Menampilkan <strong>{filteredAssets.length}</strong> dari <strong>{assets.length}</strong> total aset terdaftar</span>
          <span className="text-[11px] text-emerald-700 font-bold">GABAH Dual-Numbering Engine: Active</span>
        </div>
      </div>

      <BatchQRPrintModal
        isOpen={isBatchQrOpen}
        onClose={() => setIsBatchQrOpen(false)}
        assets={filteredAssets}
      />
    </div>
  );
};
