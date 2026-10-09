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
  onCreateAsset: (newAsset: Partial<Asset>) => void;
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
  onCreateAsset, 
  currentUser 
}) => {
  const [resolvedUser, setResolvedUser] = useState<UserProfile | undefined>(currentUser);

  useEffect(() => {
    setResolvedUser(currentUser);
    if (!isOpen) return;
    gabahApi.getMe().then(user => {
      if (user) setResolvedUser(user as UserProfile);
    }).catch(() => undefined);
  }, [isOpen, currentUser]);

  // Determine user role and authorized divisions
  const userRole = resolvedUser?.role || 'Karyawan';
  const isSuperadmin = userRole === 'Admin GABAH' || userRole === 'Superadmin' || userRole === 'Management';

  // T2B-3: master kategori aset tetap dari server (`db.categories`, hasil CRUD
  // Admin GABAH) — sumber kebenaran tunggal untuk pilihan kategori di form ini.
  // null = gagal diambil (offline/masih memuat) → daftar statis tetap dipakai
  // sebagai fallback sehingga form tidak pernah kosong.
  const [masterCategories, setMasterCategories] = useState<any[] | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    gabahApi.getCategories()
      .then(list => { if (alive && Array.isArray(list) && list.length > 0) setMasterCategories(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);

  const masterByCode = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of masterCategories || []) {
      if (c && c.code) map.set(String(c.code).toUpperCase(), c);
    }
    return map;
  }, [masterCategories]);

  // Kode terpilih layak dipakai bila: master belum termuat (fallback), ATAU
  // kode terdaftar di master dan berstatus aktif. Kategori nonaktif/dihapus
  // admin tidak muncul sebagai pilihan baru (nilai historis aset tetap utuh).
  const isCodeSelectable = (code: string): boolean => {
    if (!masterCategories) return true;
    const row = masterByCode.get(String(code || '').toUpperCase());
    return Boolean(row) && row.is_active !== false;
  };

  // Allowed fixed asset main categories according to corporate RBAC
  const allowedMainCategories = useMemo<FixedAssetCategoryDef[]>(() => {
    let roleGroups = FIXED_ASSET_TAXONOMY;
    if (!isSuperadmin) {
      if (userRole === 'IT') {
        roleGroups = FIXED_ASSET_TAXONOMY.filter(cat => cat.type === 'IT-H' || cat.type === 'IT-S');
      } else if (userRole === 'GA') {
        // GA owns INV-F, INV-P, KDR, BGN, TNH, LNY (All IT items are owned by IT; GA has read-only)
        roleGroups = FIXED_ASSET_TAXONOMY.filter(cat => ['INV-F', 'INV-P', 'KDR', 'BGN', 'TNH', 'LNY'].includes(cat.type));
      } else if (userRole === 'Supply Chain') {
        roleGroups = FIXED_ASSET_TAXONOMY.filter(cat => cat.type === 'MSN' || cat.type === 'KDR');
      } else if (userRole === 'PIBC') {
        roleGroups = FIXED_ASSET_TAXONOMY.filter(cat => cat.type === 'MSN' || cat.type === 'BGN');
      }
    }

    // T2B-3: terapkan master —
    // 1) subkategori statis yang nonaktif/dihapus di master dibuang;
    // 2) kategori master BARU (dibuat admin, tidak ada di daftar statis)
    //    ditambahkan ke kelompok main_type-nya — form selalu mencerminkan master;
    // 3) is_loanable_by_default & category_type diambil dari bila ada di master.
    return roleGroups
      .map(group => {
        const kept = group.subcategories
          .filter(s => isCodeSelectable(s.code))
          .map(s => {
            const master = masterByCode.get(String(s.code).toUpperCase());
            return {
              ...s,
              isLoanableDefault: master && master.is_loanable_by_default !== undefined
                ? Boolean(master.is_loanable_by_default)
                : s.isLoanableDefault,
            };
          });
        const extras = (masterCategories || [])
          .filter(c => c && c.is_active !== false
            && String(c.main_type || '').toUpperCase() === group.type
            && !group.subcategories.some(s => String(s.code).toUpperCase() === String(c.code).toUpperCase()))
          .map(c => ({
            code: String(c.code).toUpperCase(),
            name: String(c.name || c.code),
            placeholderName: String(c.name || c.code),
            placeholderBrand: '',
            placeholderModel: '',
            isLoanableDefault: Boolean(c.is_loanable_by_default),
          }));
        return { ...group, subcategories: [...kept, ...extras] };
      })
      .filter(group => group.subcategories.length > 0);
  }, [userRole, isSuperadmin, masterCategories, masterByCode]);

  // Selected state
  const [selectedMainType, setSelectedMainType] = useState<FixedAssetMainType>('IT-H');
  const [selectedSubIndex, setSelectedSubIndex] = useState<number>(0);
  const [selectedDivision, setSelectedDivision] = useState<OwnerDivision>('IT');

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

  // Sync division when main type or subcategory changes
  useEffect(() => {
    if (activeMainCat.type === 'INV-F') {
      // Corporate Rule: Semua furniture adalah milik GA walau ada dimanapun
      setSelectedDivision('GA');
    } else if (activeMainCat.type === 'IT-H' || activeMainCat.type === 'IT-S') {
      // Corporate Rule: Semua barang IT adalah milik IT
      setSelectedDivision('IT');
    } else if (activeSub.divisionOverride) {
      setSelectedDivision(activeSub.divisionOverride);
    } else if (!isSuperadmin) {
      if (userRole === 'Supply Chain') setSelectedDivision('SC');
      else if (userRole === 'PIBC') setSelectedDivision('PIBC');
      else if (userRole === 'GA') setSelectedDivision('GA');
      else setSelectedDivision(activeMainCat.defaultDivision);
    }
  }, [activeMainCat, activeSub, userRole, isSuperadmin]);

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

  // Calculate live preview number
  const currentYear = new Date().getFullYear();
  const subCode = activeSub.code;
  const livePreviewNumber = `${selectedDivision}-${subCode}-${currentYear}-0001`;

  if (!isOpen || !activeMainCat) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

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

    onCreateAsset(newAsset);
    onClose();
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
                Sistem Penomoran Resmi GABAH BUMD Food Station ({selectedDivision}-{subCode}-{currentYear}-XXXX)
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
                disabled={activeMainCat.isDivisionLocked && !isSuperadmin}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 disabled:bg-slate-100 disabled:text-slate-600"
              >
                <option value="IT">IT — Tim Teknologi Informasi</option>
                <option value="GA">GA — Tim General Affair</option>
                <option value="SC">SC — Tim Supply Chain &amp; Pergudangan</option>
                <option value="PIBC">PIBC — Tim Pasar Induk Beras Cipinang</option>
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
                  Format Nomor Aset Resmi (Live Preview)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                  Otomatis
                </span>
              </div>
              
              <div className="font-mono text-base sm:text-lg font-black text-emerald-400 bg-slate-800/90 px-3.5 py-2.5 rounded-lg border border-slate-700 tracking-wide flex items-center justify-between">
                <span>{livePreviewNumber}</span>
                <span className="text-[10px] text-slate-400 font-sans font-medium">Seq +1</span>
              </div>

              <div className="text-[10.5px] text-slate-400 mt-1.5 flex items-center gap-2">
                <span>Format:</span>
                <span className="font-mono text-slate-300">{selectedDivision}-{subCode}-{currentYear}-XXXX</span>
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
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black transition-all shadow-xs flex items-center gap-1.5"
            >
              <Package className="w-4 h-4" />
              <span>Simpan Aset ke Database GABAH</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
