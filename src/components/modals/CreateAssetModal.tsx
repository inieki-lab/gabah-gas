import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Package, 
  Tag, 
  Lock, 
  ShieldAlert, 
  Info,
  Laptop, 
  KeyRound, 
  Armchair, 
  Utensils, 
  Car, 
  Cog, 
  Building2, 
  MapPin, 
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { Asset, AssetCategoryType, OwnerDivision, UserProfile } from '../../types';
import { gabahApi } from '../../services/gabahApi';

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAssets?: Asset[];
  onCreateAsset: (newAsset: Partial<Asset>) => Promise<boolean>;
  currentUser?: UserProfile;
}

export type FixedAssetMainType = 'TNH' | 'BGN' | 'MSN' | 'KDR' | 'INV-F' | 'INV-P' | 'IT-H' | 'IT-S' | 'LNY';

export interface FixedAssetCategoryDef {
  type: FixedAssetMainType;
  label: string;
  categoryType: AssetCategoryType;
  defaultDivision: OwnerDivision;
  isDivisionLocked?: boolean;
  ruleNote?: string;
  iconName: string;
  subcategories: {
    code: string;
    name: string;
    placeholderName: string;
    placeholderBrand: string;
    placeholderModel: string;
    isLoanableDefault?: boolean;
    divisionOverride?: OwnerDivision;
  }[];
}

export const FIXED_ASSET_TAXONOMY: FixedAssetCategoryDef[] = [
  {
    type: 'IT-H',
    label: 'IT-H — IT Hardware (Perangkat Keras & Jaringan)',
    categoryType: 'IT',
    defaultDivision: 'IT',
    isDivisionLocked: true,
    ruleNote: 'Semua barang IT adalah aset milik IT; divisi GA hanya memiliki izin lihat (read-only).',
    iconName: 'laptop',
    subcategories: [
      { code: 'HLT', name: 'Laptop / Notebook Komputasi Portabel', placeholderName: 'ThinkPad T14 Gen 4 Core i7', placeholderBrand: 'Lenovo', placeholderModel: 'ThinkPad T14 Gen 4', isLoanableDefault: true },
      { code: 'HPC', name: 'Komputer Desktop / PC Tower', placeholderName: 'OptiPlex 7010 Desktop Workstation', placeholderBrand: 'Dell', placeholderModel: 'OptiPlex 7010 SFF', isLoanableDefault: false },
      { code: 'HSV', name: 'Server Fisik & Datacenter', placeholderName: 'PowerEdge R750 Enterprise Server', placeholderBrand: 'Dell EMC', placeholderModel: 'PowerEdge R750', isLoanableDefault: false },
      { code: 'HWS', name: 'Workstation Spesifikasi Tinggi', placeholderName: 'HP Z4 G5 Workstation Desain', placeholderBrand: 'HP', placeholderModel: 'Z4 G5', isLoanableDefault: false },
      { code: 'HMON', name: 'Monitor Komputer', placeholderName: 'UltraSharp 27 Inch IPS 4K', placeholderBrand: 'Dell', placeholderModel: 'U2723QE', isLoanableDefault: false },
      { code: 'HPRN', name: 'Printer Dokumen & Barcode Scanner', placeholderName: 'LaserJet Pro MFP 4103fdw', placeholderBrand: 'HP', placeholderModel: 'MFP 4103fdw', isLoanableDefault: false },
      { code: 'HSCN', name: 'Scanner Dokumen Arsip (ADF)', placeholderName: 'ScanSnap iX1600 Flatbed', placeholderBrand: 'Fujitsu / Ricoh', placeholderModel: 'ScanSnap iX1600', isLoanableDefault: false },
      { code: 'HNET', name: 'Perangkat Jaringan (Switch / Router / AP)', placeholderName: 'Catalyst 9300 48-Port PoE+', placeholderBrand: 'Cisco', placeholderModel: 'C9300-48P', isLoanableDefault: false },
      { code: 'HFW', name: 'Firewall & Cyber Security Gateway', placeholderName: 'FortiGate 100F Next-Gen Firewall', placeholderBrand: 'Fortinet', placeholderModel: 'FG-100F', isLoanableDefault: false },
      { code: 'HSTG', name: 'Storage NAS / SAN & Backup', placeholderName: 'Synology RackStation 12-Bay', placeholderBrand: 'Synology', placeholderModel: 'RS2423+', isLoanableDefault: false },
      { code: 'HUPS', name: 'UPS Daya Cadangan Server & Jaringan', placeholderName: 'Smart-UPS RT 3000VA Online 230V', placeholderBrand: 'APC Schneider', placeholderModel: 'SRT3000XLI', isLoanableDefault: false },
      { code: 'HRCK', name: 'Server Rack Cabinet 42U Enclosure', placeholderName: 'NetShelter SX 42U Server Rack', placeholderBrand: 'APC', placeholderModel: 'AR3100', isLoanableDefault: false },
    ],
  },
  {
    type: 'IT-S',
    label: 'IT-S — IT Software & Lisensi (SaaS & OS)',
    categoryType: 'License',
    defaultDivision: 'IT',
    isDivisionLocked: true,
    ruleNote: 'Semua lisensi software adalah aset milik IT; divisi GA hanya memiliki izin lihat (read-only).',
    iconName: 'key',
    subcategories: [
      { code: 'SLIC', name: 'Lisensi Software SaaS Enterprise (M365, Antivirus, ERP)', placeholderName: 'Microsoft 365 Business Premium E3', placeholderBrand: 'Microsoft', placeholderModel: 'M365 Enterprise', isLoanableDefault: false },
      { code: 'SLIC', name: 'Lisensi Database & Server Operating System', placeholderName: 'Windows Server 2025 Datacenter Edition', placeholderBrand: 'Microsoft', placeholderModel: 'WinSvr 2025 DC', isLoanableDefault: false },
    ],
  },
  {
    type: 'INV-F',
    label: 'INV-F — Inventaris Furniture (Meja, Kursi, Lemari)',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: true,
    ruleNote: 'Semua furniture adalah milik GA meski ada dimanapun lokasinya.',
    iconName: 'armchair',
    subcategories: [
      { code: 'INV-F', name: 'Meja Kerja Staff & Manajer', placeholderName: 'Meja Kerja Modular 140x70cm dengan Grommet', placeholderBrand: 'Indachi', placeholderModel: 'Office Desk Modern', isLoanableDefault: false },
      { code: 'INV-F', name: 'Kursi Kerja Ergonomis', placeholderName: 'Kursi Kerja Ergonomis Mesh Jaring', placeholderBrand: 'Ergotec', placeholderModel: 'Ergotec 801 SP', isLoanableDefault: false },
      { code: 'INV-F', name: 'Lemari Arsip & Filing Cabinet Besi', placeholderName: 'Filing Cabinet Besi 4 Laci Central Lock', placeholderBrand: 'Lion Metal', placeholderModel: 'L-4D Steel', isLoanableDefault: false },
      { code: 'INV-F', name: 'Meja Rapat & Konferensi', placeholderName: 'Meja Konferensi Ruang Rapat 12 Seat', placeholderBrand: 'Modera', placeholderModel: 'Boardroom 360', isLoanableDefault: false },
      { code: 'INV-F', name: 'Partisi Ruangan & Sekat Modular', placeholderName: 'Partisi Kain Fabric Akustik 120x150cm', placeholderBrand: 'Uno Partition', placeholderModel: 'Acoustic Panel', isLoanableDefault: false },
    ],
  },
  {
    type: 'INV-P',
    label: 'INV-P — Inventaris Peralatan & Perlengkapan',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: false,
    ruleNote: 'Peralatan kantor, kompor & perlengkapan dapur/pantry, AC, dan APAR pemadam api.',
    iconName: 'utensils',
    subcategories: [
      { code: 'INV-P', name: 'Kompor Gas & Perlengkapan Dapur Pantry', placeholderName: 'Kompor Gas 2 Tungku Stainless Steel Pantry', placeholderBrand: 'Rinnai', placeholderModel: 'RI-522E', isLoanableDefault: false },
      { code: 'INV-P', name: 'Dispenser Air Galon Bawah & Kulkas', placeholderName: 'Dispenser Galon Bawah Panas Dingin Normal', placeholderBrand: 'Miyako', placeholderModel: 'WDP-300', isLoanableDefault: false },
      { code: 'INV-P', name: 'AC Split & Pendingin Ruangan Kantor', placeholderName: 'AC Split Inverter 2 PK R32 Heavy Duty', placeholderBrand: 'Daikin', placeholderModel: 'FTKC50TVM4', isLoanableDefault: false },
      { code: 'INV-P', name: 'APAR (Alat Pemadam Api Ringan) K3', placeholderName: 'APAR Powder 6 Kg Bersertifikat Damkar', placeholderBrand: 'Yamato', placeholderModel: 'ABC Dry Chemical 6Kg', isLoanableDefault: false },
      { code: 'INV-P', name: 'Peralatan Kebersihan & Vacuum Cleaner', placeholderName: 'Vacuum Cleaner Wet & Dry 30 Liter', placeholderBrand: 'Kärcher', placeholderModel: 'WD 3 S', isLoanableDefault: true },
      { code: 'INV-P', name: 'Toolkit & Peralatan Bengkel Pemeliharaan', placeholderName: 'Tool Set Mekanik 128 Pcs Heavy Duty', placeholderBrand: 'Tekiro', placeholderModel: '128 Pcs Mechanics Set', isLoanableDefault: true },
    ],
  },
  {
    type: 'KDR',
    label: 'KDR — Kendaraan Operasional & Logistik',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: false,
    ruleNote: 'Armada mobil dinas operasional GA dan truk logistik angkutan beras SC.',
    iconName: 'car',
    subcategories: [
      { code: 'KDR', name: 'Mobil Dinas / Penumpang Operasional (GA)', placeholderName: 'Toyota Avanza 1.5 G M/T Operasional', placeholderBrand: 'Toyota', placeholderModel: 'Avanza 1.5 G', isLoanableDefault: true, divisionOverride: 'GA' },
      { code: 'KDR', name: 'Sepeda Motor Patroli / Kurir (GA)', placeholderName: 'Honda Vario 125 CBS Kurir Kantor', placeholderBrand: 'Honda', placeholderModel: 'Vario 125 CBS', isLoanableDefault: true, divisionOverride: 'GA' },
      { code: 'KDR', name: 'Truk Wingbox / Angkutan Beras Logistik (SC)', placeholderName: 'Truk Hino Dutro 130 HD Wingbox Beras', placeholderBrand: 'Hino', placeholderModel: 'Dutro 130 HD', isLoanableDefault: true, divisionOverride: 'SC' },
    ],
  },
  {
    type: 'MSN',
    label: 'MSN — Mesin Produksi, Milling & Timbangan',
    categoryType: 'General',
    defaultDivision: 'SC',
    isDivisionLocked: false,
    ruleNote: 'Mesin rice milling plant, forklift gudang beras SC, dan jembatan timbang PIBC.',
    iconName: 'cog',
    subcategories: [
      { code: 'MSN', name: 'Mesin Rice Milling Plant / Penggilingan Beras (SC)', placeholderName: 'Paddy Husker & Rice Polisher 10 Ton/Jam', placeholderBrand: 'Satake', placeholderModel: 'HR-10D Rice Mill', isLoanableDefault: false, divisionOverride: 'SC' },
      { code: 'MSN', name: 'Forklift Diesel / Elektrik Gudang (SC)', placeholderName: 'Forklift Diesel 3 Ton Mast 4.5 Meter', placeholderBrand: 'Toyota Forklift', placeholderModel: '8FD30', isLoanableDefault: false, divisionOverride: 'SC' },
      { code: 'MSN', name: 'Mesin Packing & Sealing Beras Otomatis (SC)', placeholderName: 'Automatic Packaging Machine 5Kg-25Kg', placeholderBrand: 'Newlong', placeholderModel: 'DS-9C Packing Line', isLoanableDefault: false, divisionOverride: 'SC' },
      { code: 'MSN', name: 'Jembatan Timbang 60 Ton Kalibrasi Tera (PIBC)', placeholderName: 'Jembatan Timbang Truk 60 Ton Tera Sah', placeholderBrand: 'Avery Weigh-Tronix', placeholderModel: 'BridgeScale 60T', isLoanableDefault: false, divisionOverride: 'PIBC' },
      { code: 'MSN', name: 'Genset Utama Pembangkit Daya Darurat (GA/PIBC)', placeholderName: 'Genset Silent Diesel 250 kVA Standby', placeholderBrand: 'Cummins', placeholderModel: 'C250 D5e', isLoanableDefault: false, divisionOverride: 'GA' },
    ],
  },
  {
    type: 'BGN',
    label: 'BGN — Bangunan Fisik, Gedung & Gudang',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: false,
    ruleNote: 'Gedung kantor pusat, pergudangan Cipinang, dan fasilitas pasar.',
    iconName: 'building',
    subcategories: [
      { code: 'BGN', name: 'Gedung Kantor Pusat Food Station', placeholderName: 'Gedung Perkantoran 4 Lantai Head Office', placeholderBrand: 'Food Station Tjipinang', placeholderModel: 'Gedung A', isLoanableDefault: false, divisionOverride: 'GA' },
      { code: 'BGN', name: 'Gudang Beras Modern Kompleks PIBC', placeholderName: 'Gudang Beras Blok B-04 Kapasitas 5000 Ton', placeholderBrand: 'Kawasan PIBC', placeholderModel: 'Gudang Modern', isLoanableDefault: false, divisionOverride: 'GA' },
      { code: 'BGN', name: 'Fasilitas Pasar & Pos Jaga Cipinang (PIBC)', placeholderName: 'Pos Ukur Tera & Gerbang Akses Truk PIBC', placeholderBrand: 'Kawasan Pasar', placeholderModel: 'Posko Barat', isLoanableDefault: false, divisionOverride: 'PIBC' },
    ],
  },
  {
    type: 'TNH',
    label: 'TNH — Tanah & Lahan Korporat',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: true,
    ruleNote: 'Lahan kawasan Food Station Cipinang & sentra produksi pangan.',
    iconName: 'mappin',
    subcategories: [
      { code: 'TNH', name: 'Lahan Kawasan Pasar Induk Beras Cipinang', placeholderName: 'Lahan Pergudangan & Distribusi PIBC 8.5 Hektar', placeholderBrand: 'BUMD DKI Jakarta', placeholderModel: 'HGB No. 1290', isLoanableDefault: false },
    ],
  },
  {
    type: 'LNY',
    label: 'LNY — Aset Tetap Lainnya',
    categoryType: 'General',
    defaultDivision: 'GA',
    isDivisionLocked: false,
    ruleNote: 'Aset tetap umum penunjang operasional kantor.',
    iconName: 'help',
    subcategories: [
      { code: 'LNY', name: 'Aset Penunjang Operasional Lainnya', placeholderName: 'Aset Penunjang Khusus Operasional', placeholderBrand: 'General', placeholderModel: 'Standard Spec', isLoanableDefault: false },
    ],
  },
];

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateAsset 
}) => {
  const [assetCreateOptions, setAssetCreateOptions] = useState<{ owner_domains: Array<{ code: string; name: string }>; categories: any[] } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [masterCategories, setMasterCategories] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<OwnerDivision>('');

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setOptionsLoading(true);
    setOptionsError('');
    setAssetCreateOptions(null);
    setMasterCategories([]);
    gabahApi.getAssetCreateOptions()
      .then(options => {
        if (!alive) return;
        const owners = Array.isArray(options?.owner_domains) ? options.owner_domains : [];
        const categories = Array.isArray(options?.categories) ? options.categories : [];
        setAssetCreateOptions({ owner_domains: owners, categories });
        setMasterCategories(categories);
        setSelectedDivision(current => owners.some(owner => owner.code === current) ? current : (owners[0]?.code || ''));
      })
      .catch(error => {
        if (alive) setOptionsError(error instanceof Error ? error.message : 'Gagal memuat kewenangan pendaftaran aset.');
      })
      .finally(() => { if (alive) setOptionsLoading(false); });
    return () => { alive = false; };
  }, [isOpen]);

  const ownerDomains = assetCreateOptions?.owner_domains || [];
  const masterByCode = useMemo(() => {
    const map = new Map<string, any>();
    for (const category of masterCategories) {
      if (category?.code) map.set(String(category.code).toUpperCase(), category);
    }
    return map;
  }, [masterCategories]);

  // All choices are based on active server master rows and effective owner write scope.
  const allowedMainCategories = useMemo<FixedAssetCategoryDef[]>(() => {
    const grouped = new Map<string, FixedAssetCategoryDef>();
    const owner = String(selectedDivision || '').trim().toUpperCase();
    for (const category of masterCategories) {
      if (!category || category.is_active === false) continue;
      if (!owner || String(category.owner_division || '').trim().toUpperCase() !== owner) continue;
      const type = String(category.main_type || 'LNY').trim().toUpperCase() as FixedAssetMainType;
      const template = FIXED_ASSET_TAXONOMY.find(item => item.type === type);
      const templateSub = template?.subcategories.find(item => String(item.code).toUpperCase() === String(category.code || '').toUpperCase());
      const subcategory = {
        ...(templateSub || {}),
        code: String(category.code || '').trim().toUpperCase(),
        name: String(category.name || category.code || '').trim(),
        placeholderName: templateSub?.placeholderName || String(category.name || category.code || '').trim(),
        placeholderBrand: templateSub?.placeholderBrand || '',
        placeholderModel: templateSub?.placeholderModel || '',
        isLoanableDefault: Boolean(category.is_loanable_by_default),
        divisionOverride: owner,
      };
      if (!subcategory.code) continue;
      const existing = grouped.get(type);
      if (existing) existing.subcategories.push(subcategory);
      else grouped.set(type, {
        type,
        label: template?.label || `${type} — ${type}`,
        categoryType: (category.category_type || template?.categoryType || 'General') as AssetCategoryType,
        defaultDivision: owner,
        isDivisionLocked: ownerDomains.length <= 1,
        ruleNote: template?.ruleNote || 'Kategori dan owner mengikuti master aktif serta kewenangan akun.',
        iconName: template?.iconName || 'package',
        subcategories: [subcategory],
      });
    }
    return Array.from(grouped.values());
  }, [masterCategories, selectedDivision, ownerDomains.length]);

  // Selected state
  const [selectedMainType, setSelectedMainType] = useState<FixedAssetMainType>('IT-H');
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(0);

  // Sync selected main type when modal opens or allowed categories change
  useEffect(() => {
    if (allowedMainCategories.length > 0) {
      const match = allowedMainCategories.find(c => c.type === selectedMainType);
      if (!match) {
        setSelectedMainType(allowedMainCategories[0].type);
        setSelectedSubIndex(0);
      }
    }
  }, [allowedMainCategories, selectedMainType]);

  const activeMainCat = useMemo(() => {
    return allowedMainCategories.find(c => c.type === selectedMainType) || allowedMainCategories[0] || FIXED_ASSET_TAXONOMY[0];
  }, [allowedMainCategories, selectedMainType]);

  const activeSub = useMemo(() => {
    return activeMainCat.subcategories[selectedSubIndex] || activeMainCat.subcategories[0];
  }, [activeMainCat, selectedSubIndex]);

  // Owner selection is server-authoritative; category choices are already filtered to it.

  // Fields
  const [name, setName] = useState('');
  const [corporateAssetNumber, setCorporateAssetNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState<number>(15000000);
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [location, setLocation] = useState('Head Office Food Station');
  // T2B-2: pemilihan lokasi fisik dari master aktif; "" = lokasi di luar
  // master (teks bebas legacy). Saat master dipilih, teks `location` ikut
  // disinkronkan ke path lengkap agar tampilan lama tetap konsisten.
  const [assetLocations, setAssetLocations] = useState<any[]>([]);
  const [assetLocationId, setAssetLocationId] = useState<string>('');
  const [custodianName, setCustodianName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
  const [isLoanable, setIsLoanable] = useState(false);
  const [notes, setNotes] = useState('');

  // License fields
  const [totalSeats, setTotalSeats] = useState<number>(50);
  const [renewalCost, setRenewalCost] = useState<number>(25000000);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'perpetual'>('yearly');

  // Auto populate placeholders when subcategory changes if fields are empty
  useEffect(() => {
    if (activeSub) {
      if (!name || name === activeMainCat.subcategories[0]?.name) {
        setName(activeSub.placeholderName);
      }
      setBrand(activeSub.placeholderBrand);
      setModel(activeSub.placeholderModel);
      setIsLoanable(activeSub.isLoanableDefault ?? false);
    }
  }, [activeSub, activeMainCat]);

  // The authoritative asset number is generated by the server at save time.
  const subCode = activeSub.code;

  if (!isOpen) return null;
  if (optionsLoading) return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-6"><div className="rounded-xl bg-white px-6 py-5 text-sm font-semibold text-slate-700">Memuat kewenangan pendaftaran aset...</div></div>;
  if (optionsError) return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-6"><div className="max-w-md rounded-xl bg-white p-6 text-sm text-rose-700"><p className="font-bold">Pilihan owner aset gagal dimuat.</p><p className="mt-2">{optionsError}</p><button type="button" onClick={onClose} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white">Tutup</button></div></div>;
  if (!ownerDomains.length || !allowedMainCategories.length || !activeSub) return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-6"><div className="max-w-md rounded-xl bg-white p-6 text-sm text-slate-700"><p className="font-bold">Tidak ada owner aset yang dapat didaftarkan.</p><p className="mt-2">Akun ini belum memiliki permission assets.create dan scope owner yang sesuai, atau belum ada kategori aktif pada owner tersebut. Hubungi Superadmin untuk pemeriksaan hak akses dan master kategori.</p><button type="button" onClick={onClose} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white">Tutup</button></div></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !name.trim()) return;

    const newAsset: Partial<Asset> = {
      name: name.trim(),
      owner_division: selectedDivision,
      category_code: subCode,
      // T2B-3: tipe taksonomi mengikuti master bila kategori terdaftar di sana.
      category_type: (masterByCode.get(String(subCode).toUpperCase())?.category_type as Asset['category_type'])
        || activeMainCat.categoryType,
      subcategory: activeSub.name,
      corporate_asset_number: corporateAssetNumber.trim() ? corporateAssetNumber.trim() : null,
      brand: brand.trim(),
      model: model.trim(),
      serial_number: serialNumber.trim() || `SN-${Date.now().toString().slice(-6)}`,
      specifications: specifications.trim(),
      purchase_date: purchaseDate,
      purchase_price: Number(purchasePrice),
      warranty_until: warrantyUntil || purchaseDate,
      status: 'available',
      condition: 'good',
      // T2B-2: master lokasi terpilih → relasi + teks path (sinkron);
      // "" → hanya teks bebas legacy (tanpa relasi).
      asset_location_id: assetLocationId || null,
      location: (assetLocationId ? assetLocationPath(assetLocationId) : location.trim()) || location.trim(),
      is_loanable: isLoanable,
      notes: notes.trim(),
    };

    if (custodianName.trim()) {
      newAsset.assigned_to = {
        id: `CUST-${Date.now().toString().slice(-4)}`,
        name: custodianName.trim(),
        department: location,
      };
    }

    if (activeMainCat.categoryType === 'License') {
      newAsset.license_detail = {
        total_seats: totalSeats,
        used_seats: 0,
        billing_cycle: billingCycle,
        expiration_date: warrantyUntil || '2027-12-31',
        renewal_cost: Number(renewalCost),
      };
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const saved = await onCreateAsset(newAsset);
      if (!saved) {
        setSubmitError('Aset belum tersimpan. Isian tetap tersedia; periksa notifikasi dan coba kembali.');
        return;
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Gagal menyimpan aset. Isian tetap tersedia; coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl my-6">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Pendaftaran Aset Tetap Baru</h3>
              <p className="text-xs text-slate-500">
                Nomor aset diterbitkan server berdasarkan aturan aktif saat disimpan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 text-xs max-h-[80vh] overflow-y-auto">
          
          {/* Row 1: Devisi / Departemen Pemilik & Jenis Aset Tetap Master */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Devisi / Departemen Pemilik */}
            <div className="space-y-1.5">
              <label className="text-slate-800 font-bold flex items-center justify-between">
                <span>1. Devisi / Departemen Pemilik:</span>
                {activeMainCat.isDivisionLocked && (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Terkunci Sistem
                  </span>
                )}
              </label>
              
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value as OwnerDivision)}
                disabled={ownerDomains.length <= 1}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-600"
              >
                {ownerDomains.map(owner => (
                  <option key={owner.code} value={owner.code}>{owner.code} — {owner.name}</option>
                ))}
              </select>

              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                {activeMainCat.type === 'INV-F' && 'Semua furniture (INV-F) adalah milik GA walau ditaruh di ruangan/divisi manapun.'}
                {(activeMainCat.type === 'IT-H' || activeMainCat.type === 'IT-S') && 'Semua barang IT adalah milik IT. GA hanya memiliki akses lihat (read-only).'}
                {activeMainCat.type !== 'INV-F' && activeMainCat.type !== 'IT-H' && activeMainCat.type !== 'IT-S' && 'Aset dicatat resmi di bawah divisi pemilik penanggung jawab.'}
              </p>
            </div>

            {/* Jenis Aset Tetap Master */}
            <div className="space-y-1.5">
              <label className="text-slate-800 font-bold flex items-center justify-between">
                <span>2. Jenis Aset Tetap Master:</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Kode: {activeMainCat.type}
                </span>
              </label>

              <select
                value={selectedMainType}
                onChange={(e) => {
                  setSelectedMainType(e.target.value as FixedAssetMainType);
                  setSelectedSubIndex(0);
                }}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {allowedMainCategories.map((cat) => (
                  <option key={cat.type} value={cat.type}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <p className="text-[10.5px] text-slate-500">
                Kategori terdaftar sesuai standar baku klasifikasi aset BUMD Food Station.
              </p>
            </div>

          </div>

          {/* Row 2: Sub-Kategori / Pilihan Detail Barang */}
          <div className="space-y-1.5 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
            <div className="flex items-center justify-between">
              <label className="text-emerald-950 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>3. Sub-Kategori / Jenis Barang (Dropdown Spesifik):</span>
              </label>
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                <span>Sub-Kode:</span>
                <span className="text-emerald-900 font-black">{subCode}</span>
              </div>
            </div>

            <select
              value={selectedSubIndex}
              onChange={(e) => setSelectedSubIndex(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            >
              {activeMainCat.subcategories.map((sub, idx) => (
                <option key={`${sub.code}-${idx}`} value={idx}>
                  {sub.name} [Kode: {sub.code}]
                </option>
              ))}
            </select>

            {/* Corporate Rule Alert Banner */}
            <div className="mt-2 flex items-start gap-2 text-[11px] text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-200">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Aturan Korporat: </strong>
                <span>{activeMainCat.ruleNote}</span>
              </div>
            </div>
          </div>

          {/* Row 3: Live Format Numbering Preview Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 bg-slate-900 text-white rounded-xl shadow-inner">
            <div>
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  Penerbitan Nomor Aset (Server)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                  Otomatis
                </span>
              </div>
              
              <div className="font-mono text-sm sm:text-base font-bold text-emerald-300 bg-slate-800/90 px-3.5 py-3 rounded-lg border border-slate-700">
                Nomor diterbitkan server saat penyimpanan
              </div>
              <div className="text-[10.5px] text-slate-400 mt-1.5">
                Format dan sequence mengikuti aturan aktif di database; pratinjau ini tidak menebak nomor berikutnya.
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider">
                  Nomor Aset ERP / Akuntansi (Accurate)
                </label>
                <span className="text-[10px] text-slate-400">Opsional</span>
              </div>

              <input
                type="text"
                placeholder="Contoh: FST-24-0332 atau ACC-0912"
                value={corporateAssetNumber}
                onChange={(e) => setCorporateAssetNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />

              <p className="text-[10.5px] text-slate-400 mt-1.5">
                Nomor barcode/register ERP finansial jika sudah tercatat di sistem pembukuan.
              </p>
            </div>
          </div>

          {/* Asset Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Nama Aset Lengkap:</label>
              <input
                type="text"
                required
                placeholder="Contoh: ThinkPad L14 Gen 4, Meja Kerja Staff, Avanza 1.5 G"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Merk / Brand:</label>
              <input
                type="text"
                required
                placeholder="Contoh: Lenovo, Toyota, Daikin, Microsoft, Satake"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Model / Tipe:</label>
              <input
                type="text"
                required
                placeholder="Contoh: T14 Gen 4, Avanza G, PowerEdge R750"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Serial Number / Nopol / No. Rangka:</label>
              <input
                type="text"
                placeholder="Contoh: PF-89912 / B 1842 PQU"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-1">
            <label className="text-slate-800 font-bold">Spesifikasi Teknis / Dimensi / Kapasitas:</label>
            <textarea
              rows={2}
              placeholder="Contoh: Core i7-1355U, 16GB RAM, 512GB SSD / Kapasitas 140x70x75cm besi partisi / Kapasitas 60 Ton Kalibrasi Metrologi..."
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Financial & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Harga Perolehan (IDR):</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Tanggal Pembelian:</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-800 font-bold">Garansi / Kalibrasi Hingga:</label>
              <input
                type="date"
                value={warrantyUntil}
                onChange={(e) => setWarrantyUntil(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Location & Custodian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-800 font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Lokasi Fisik Penempatan:
              </label>
              <select
                value={assetLocationId}
                onChange={(e) => {
                  const id = e.target.value;
                  setAssetLocationId(id);
                  if (id) setLocation(assetLocationPath(id));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="">— Di luar master (isi teks manual) —</option>
                {assetLocations.filter(l => l.is_active).map(l => (
                  <option key={l.id} value={l.id}>{assetLocationPath(l.id)}</option>
                ))}
              </select>
              {!assetLocationId && (
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Head Office Lt. 2, Gudang Cipinang Blok A, Pabrik Sragen"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              )}
              {assetLocationId && (
                <p className="text-[10px] text-slate-400">Teks lokasi legacy otomatis mengikuti path master terpilih.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-slate-800 font-bold flex items-center gap-1">
                Pengguna / Custodian Awal (Opsional):
              </label>
              <input
                type="text"
                value={custodianName}
                onChange={(e) => setCustodianName(e.target.value)}
                placeholder="Nama karyawan pemegang (kosongkan jika Pool / Fasilitas Umum)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* License Specific Configuration */}
          {activeMainCat.categoryType === 'License' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
              <div>
                <label className="font-bold text-purple-900">Total User Seats:</label>
                <input
                  type="number"
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-purple-900">Siklus Penagihan:</label>
                <select
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as any)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-semibold"
                >
                  <option value="monthly">Bulanan (Monthly)</option>
                  <option value="yearly">Tahunan (Yearly Subscription)</option>
                  <option value="perpetual">Perpetual (Sekali Beli)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-purple-900">Biaya Renewal (IDR):</label>
                <input
                  type="number"
                  value={renewalCost}
                  onChange={(e) => setRenewalCost(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Toggle Is Loanable */}
          {activeMainCat.categoryType !== 'License' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Izinkan Peminjaman (Pool / Fasilitas Bersama)</div>
                <div className="text-[11px] text-slate-500">
                  Aset dapat diajukan pinjam oleh staf lain dan diverifikasi bebas bentrok jadwal otomatis.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLoanable}
                  onChange={(e) => setIsLoanable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-slate-800 font-bold">Catatan Inventaris:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kondisi penerimaan fisik, vendor supplier, nomor kontrak PO..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* Footer Buttons */}
          {submitError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{submitError}</p>}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black transition-all shadow-xs flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan Aset...' : 'Simpan Aset ke Database GABAH'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
