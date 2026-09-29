import React, { useState } from 'react';
import { 
  X, 
  LifeBuoy, 
  AlertTriangle, 
  Clock, 
  Laptop, 
  Car, 
  KeyRound, 
  Package,
  Store,
  Info 
} from 'lucide-react';
import { Asset, Loan, TicketCategory, TicketPriority, UserProfile, Contract } from '../../types';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: Asset[];
  loans?: Loan[];
  currentUser: UserProfile;
  preselectedAssetId?: string;
  linkedContract?: Contract | null;
  onCreateTicket: (ticketData: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    related_asset_id?: string;
  }) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  assets = [],
  loans = [],
  currentUser,
  preselectedAssetId,
  linkedContract,
  onCreateTicket,
}) => {
  const [category, setCategory] = useState<TicketCategory>('IT');
  const [priority, setPriority] = useState<TicketPriority>('high');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [relatedAssetId, setRelatedAssetId] = useState<string>(preselectedAssetId || '');

  const isAuditor = currentUser?.role === 'Auditor';

  // Freshservice-inspired Quick Service Catalog Templates
  const serviceCatalogTemplates = [
    {
      id: 'hw-issue',
      label: 'Laptop / PC Kendala',
      category: 'IT' as TicketCategory,
      priority: 'high' as TicketPriority,
      title: 'Laptop / PC Kerja Mengalami Gangguan Teknis',
      desc: 'Perangkat kerja utama mengalami kendala booting, performa lambat, atau blue screen yang menghambat aktivitas harian.',
      icon: '💻',
    },
    {
      id: 'sw-access',
      label: 'Akses Software & Lisensi',
      category: 'IT' as TicketCategory,
      priority: 'medium' as TicketPriority,
      title: 'Permohonan Akun ERP Accurate / Microsoft 365 / VPN',
      desc: 'Permintaan aktivasi akun baru atau reset password lisensi kerja resmi Food Station.',
      icon: '🔑',
    },
    {
      id: 'ga-facility',
      label: 'Fasilitas & AC Kantor',
      category: 'GA' as TicketCategory,
      priority: 'medium' as TicketPriority,
      title: 'Pemeliharaan AC Ruangan / Penggantian Perabotan Kantor',
      desc: 'Unit AC ruangan kerja kurang dingin / bocor, atau perbaikan meja dan kursi ergonomis kerja.',
      icon: '❄️',
    },
    {
      id: 'sc-weighbridge',
      label: 'Timbangan & Mesin Pabrik',
      category: 'SC' as TicketCategory,
      priority: 'urgent' as TicketPriority,
      title: 'Kendala Mesin Pabrik Beras / Jembatan Timbang Truk',
      desc: 'Sensor jembatan timbang atau conveyor penggilingan beras mengalami deviasi/error butuh kalibrasi darurat.',
      icon: '🌾',
    },
    {
      id: 'incident-down',
      label: 'Gangguan Jaringan / Server',
      category: 'IT' as TicketCategory,
      priority: 'urgent' as TicketPriority,
      title: 'Insiden Jaringan Internet / WiFi / Server Down',
      desc: 'Akses jaringan di lantai kantor atau server database tidak dapat dijangkau oleh tim kerja.',
      icon: '🚨',
    },
  ];

  const applyCatalogTemplate = (tpl: typeof serviceCatalogTemplates[0]) => {
    setCategory(tpl.category);
    setPriority(tpl.priority);
    setTitle(tpl.title);
    setDescription(tpl.desc);
  };

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeLoans = Array.isArray(loans) ? loans : [];

  // Filter ONLY assets belonging to the reporter (assigned to reporter or currently loaned to reporter)
  const reporterAssignedAssets = safeAssets.filter((asset) => {
    if (!asset.assigned_to) return false;
    const assignedId = asset.assigned_to.id;
    const assignedEmail = asset.assigned_to.email?.toLowerCase();
    const currentEmail = currentUser?.email?.toLowerCase();
    const assignedName = asset.assigned_to.name?.toLowerCase();
    const currentName = currentUser?.name?.toLowerCase();

    return (
      (assignedId && assignedId === currentUser?.id) ||
      (assignedEmail && currentEmail && assignedEmail === currentEmail) ||
      (assignedName && currentName && (assignedName.includes(currentName) || currentName.includes(assignedName)))
    );
  });

  const reporterActiveLoans = safeLoans.filter((loan) => {
    const isBorrower =
      loan.borrower_id === currentUser?.id ||
      (loan.borrower_name && currentUser?.name && loan.borrower_name.toLowerCase().includes(currentUser.name.toLowerCase()));
    const isActive = ['approved', 'borrowed', 'active'].includes(loan.status);
    return isBorrower && isActive;
  });

  const reporterLoanedAssetIds = new Set(reporterActiveLoans.map(l => l.asset_id));
  const reporterLoanedAssets = safeAssets.filter(a => reporterLoanedAssetIds.has(a.id));

  // Build the reporter-only assets list
  const reporterAssetsMap = new Map<string, { asset: Asset; label: string }>();
  reporterAssignedAssets.forEach(a => {
    reporterAssetsMap.set(a.id, {
      asset: a,
      label: `[Aset Ditugaskan] [${a.asset_number}] ${a.name}`,
    });
  });
  reporterLoanedAssets.forEach(a => {
    if (!reporterAssetsMap.has(a.id)) {
      reporterAssetsMap.set(a.id, {
        asset: a,
        label: `[Aset Dipinjam] [${a.asset_number}] ${a.name}`,
      });
    }
  });

  // If a specific asset was preselected by clicking "Lapor Kendala" on an asset, ensure it is available
  if (preselectedAssetId) {
    const preselected = safeAssets.find(a => a.id === preselectedAssetId);
    if (preselected && !reporterAssetsMap.has(preselected.id)) {
      reporterAssetsMap.set(preselected.id, {
        asset: preselected,
        label: `[Aset Terpilih] [${preselected.asset_number}] ${preselected.name}`,
      });
    }
  }

  const reporterAssets = Array.from(reporterAssetsMap.values());

  const handleAssetSelect = (assetId: string) => {
    setRelatedAssetId(assetId);
    if (assetId) {
      const selected = safeAssets.find(a => a.id === assetId);
      if (selected) {
        // License/SaaS is an IT domain: software & license tickets route to IT
        if (selected.owner_division === 'SC') {
          setCategory('SC');
        } else if (selected.owner_division === 'PIBC') {
          setCategory('PIBC');
        } else if (selected.category_type === 'GA' || selected.owner_division === 'GA') {
          setCategory('GA');
        } else {
          setCategory('IT');
        }
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      if (preselectedAssetId) {
        handleAssetSelect(preselectedAssetId);
      } else {
        setRelatedAssetId('');
      }
      // Linked contract prefill: Ticket = pekerjaan atas Contract tertentu
      if (linkedContract) {
        setTitle(`Tindak Lanjut Kontrak ${linkedContract.contract_number} — ${linkedContract.title}`);
        setDescription(
          `Tiket kerja terkait kontrak ${linkedContract.contract_number} (${linkedContract.title}) dengan vendor ${linkedContract.vendor_name}. Divisi pemilik: ${linkedContract.owner_division}.`
        );
        setCategory((linkedContract.owner_division === 'IT' ? 'IT'
          : linkedContract.owner_division === 'SC' ? 'SC'
          : linkedContract.owner_division === 'PIBC' ? 'PIBC'
          : 'GA') as TicketCategory);
      }
    }
  }, [isOpen, preselectedAssetId, linkedContract]);

  if (!isOpen) return null;

  const slaHours = priority === 'urgent' ? 4 : priority === 'high' ? 8 : priority === 'medium' ? 24 : 48;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    onCreateTicket({
      title,
      description,
      category,
      priority,
      related_asset_id: relatedAssetId ? relatedAssetId : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Buat Tiket Kendala Helpdesk</h3>
              <p className="text-xs text-slate-500">Laporan penanganan IT, sarana GA, atau permintaan lisensi</p>
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
          
          {/* Reporter info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Pelapor</div>
              <div className="font-bold text-slate-900 text-sm">{currentUser.name}</div>
              <div className="text-slate-500">{currentUser.department} ({currentUser.email})</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 text-[11px]">
              {currentUser.role_label}
            </span>
          </div>

          {/* Freshservice-style Quick Service Catalog Selector */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-slate-700 font-bold text-[11px]">
              <span>Katalog Layanan Cepat (Freshservice-Style Service Catalog):</span>
              <span className="text-[10px] text-slate-500 font-normal">Klik untuk auto-fill standar ITSM</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {serviceCatalogTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyCatalogTemplate(tpl)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold whitespace-nowrap transition-all shadow-2xs shrink-0"
                >
                  <span>{tpl.icon}</span>
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-slate-700 font-bold">Departemen Penanganan:</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => { setCategory('IT'); setRelatedAssetId(''); }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  category === 'IT'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Laptop className="w-4 h-4" /> IT / Lisensi
              </button>
              <button
                type="button"
                onClick={() => { setCategory('General'); setRelatedAssetId(''); }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  category === 'GA' 
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Car className="w-4 h-4" /> General Affair (GA)
              </button>
              <button
                type="button"
                onClick={() => { setCategory('IT'); setRelatedAssetId(''); }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  category === 'IT' && title.toLowerCase().includes('lisensi')
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <KeyRound className="w-4 h-4" /> Lisensi (IT)
              </button>
              <button
                type="button"
                onClick={() => { setCategory('SC'); setRelatedAssetId(''); }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  category === 'SC' 
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Package className="w-4 h-4" /> Supply Chain
              </button>
              <button
                type="button"
                onClick={() => { setCategory('PIBC'); setRelatedAssetId(''); }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  category === 'PIBC' 
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Store className="w-4 h-4" /> PIBC
              </button>
            </div>
          </div>

          {/* Priority Level & Dynamic SLA Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold">Tingkat Prioritas (SLA Target):</label>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Target Penyelesaian: {slaHours} Jam
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 'urgent', label: 'Urgent (4 Jam)', desc: 'Gedung/server lumpuh' },
                { val: 'high', label: 'High (8 Jam)', desc: 'Kerja utama terhenti' },
                { val: 'medium', label: 'Medium (24 Jam)', desc: 'Request lisensi/akun' },
                { val: 'low', label: 'Low (48 Jam)', desc: 'Periferal & konsultasi' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setPriority(p.val as any)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    priority === p.val
                      ? 'bg-rose-50 text-rose-800 border-rose-500 ring-1 ring-rose-500 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-[11px]">{p.label}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Related Asset Selector (Mengacu Khusus Aset Pelapor) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 font-bold">Pilih Aset Terkait Pelapor:</label>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {reporterAssets.length} aset milik pelapor tersedia
              </span>
            </div>
            <select
              value={relatedAssetId}
              onChange={(e) => handleAssetSelect(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-rose-500 text-xs"
            >
              <option value="">-- Tidak Terkait Aset Tertentu / Kendala Umum / Fasilitas Kantor --</option>
              {reporterAssets.length === 0 ? (
                <option value="" disabled>
                  (Belum ada perangkat terdaftar atas nama {currentUser.name} - silakan laporkan kendala umum)
                </option>
              ) : (
                reporterAssets.map(({ asset, label }) => (
                  <option key={asset.id} value={asset.id}>
                    {label} ({asset.owner_division})
                  </option>
                ))
              )}
            </select>
            <p className="text-[10px] text-slate-500">
              * Opsi aset langsung mengacu ke perangkat yang ditugaskan resmi atau sedang dipinjam oleh <span className="font-semibold text-slate-700">{currentUser.name}</span>.
            </p>
          </div>

          {/* Ticket Title */}
          <div className="space-y-1">
            <label className="text-slate-700 font-bold">Judul Singkat Kendala:</label>
            <input
              type="text"
              required
              placeholder="Contoh: AC Lantai 3 Bocor, VPN tidak bisa login, Permintaan lisensi M365..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Ticket Description */}
          <div className="space-y-1">
            <label className="text-slate-700 font-bold">Deskripsi Rinci Masalah:</label>
            <textarea
              rows={3}
              required
              placeholder="Jelaskan sejak kapan terjadi, pesan error yang muncul, dan dampak operasionalnya..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Auditor Warning */}
          {isAuditor && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Akun Auditor berstatus <strong>Read-Only</strong> untuk kepatuhan SPI. Anda tidak dapat membuat tiket baru.</span>
            </div>
          )}

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
              disabled={isAuditor}
              className={`px-5 py-2 rounded-xl font-bold transition-all shadow-xs ${
                isAuditor 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              Kirim Tiket ke Helpdesk
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
