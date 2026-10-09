import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  LockKeyhole,
  Building2,
  MapPin,
  Database,
  Bell,
  ScrollText,
  Settings2,
  Hash,
  HeartPulse,
  X,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  ChevronRight,
  Activity,
  Check,
  Clock,
  Laptop,
  Building,
  KeyRound,
  FileSpreadsheet,
  Cpu,
  Trash2,
  UserCheck,
  UserX,
  Pencil,
  RotateCcw,
  FileText,
  Sliders,
  Info,
  Network,
  Power
} from 'lucide-react';
import { UserProfile, UserRole, AuditLog, Asset, Loan, Ticket, OwnerDivision } from '../../types';
import { gabahApi } from '../../services/gabahApi';
import { exportUsersToCsv, downloadUsersImportTemplate, parseUsersImportCsv } from '../../services/gabahService';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'roles'
  | 'organization'
  | 'org_masters'
  | 'master_data'
  | 'numbering'
  | 'notifications'
  | 'audit_log'
  | 'settings'
  | 'data_admin'
  | 'health';

interface AdministrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  auditLogs: AuditLog[];
  assets: Asset[];
  loans: Loan[];
  tickets: Ticket[];
  currentUser?: UserProfile;
  activeRole?: UserRole;
  onUpdateUser?: (updated: UserProfile) => void;
  onCreateUser?: (newUser: UserProfile) => void;
  onDeleteUser?: (userId: string) => void;
  showToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  onRefreshData?: () => Promise<void>;
}

export interface RolePermissionRow {
  role: string;
  desc: string;
  assets: string;
  loans: string;
  tickets: string;
  licenses: string;
  reports: string;
  audit: string;
  admin: string;
}

export interface OrgDivision {
  code: OwnerDivision;
  name: string;
  leader: string;
  depts: string[];
}

export interface MasterLocation {
  id: string;
  name: string;
  address: string;
  capacity: string;
}

// ORG-MODEL: master terpisah — Jabatan/Level, Unit, Kantor/Lokasi.
export interface OrgJobLevel {
  code: string;
  label: string;
  order: number;
  is_active: boolean;
}
export interface OrgUnit {
  id: string;
  name: string;
  division_code: string;
  is_active: boolean;
}
export interface OrgOfficeLocation {
  id: string;
  name: string;
  is_active: boolean;
}

export interface NotificationRule {
  id: string;
  title: string;
  trigger: string;
  target: string;
  status: 'Aktif' | 'Nonaktif';
  severity: 'warning' | 'critical' | 'info';
  daysBefore?: number;
  cutoffTime?: string;
  warningHours?: number;
}

export const SYSTEM_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Admin GABAH', label: 'Admin GABAH (Super Admin)', desc: 'Kendali Penuh Seluruh Sistem & Konfigurasi' },
  { value: 'IT', label: 'IT (Infrastruktur & Jaringan)', desc: 'Pengelola Aset TI, Komputasi & Lisensi' },
  { value: 'GA', label: 'GA (General Affairs & Fasilitas)', desc: 'Pengelola Fasilitas, Gedung & Ruang Rapat' },
  { value: 'Sekretaris Direksi', label: 'Sekretaris Direksi', desc: 'Reservasi VIP Ruang Rapat & Notifikasi Agenda' },
  { value: 'Humas', label: 'Humas & Protokoler', desc: 'Dokumentasi Acara & Rapat di Semua Ruangan' },
  { value: 'Supply Chain', label: 'Supply Chain & Pergudangan', desc: 'Pengelola Armada Truk & Pabrik Beras' },
  { value: 'PIBC', label: 'PIBC (Pasar Induk Cipinang)', desc: 'Operasional Kawasan Pasar & Retribusi' },
  { value: 'Karyawan', label: 'Karyawan (Pegawai Umum)', desc: 'Peminjaman Aset & Pengajuan Tiket' },
  { value: 'Auditor', label: 'Auditor (Satuan Pengawas Internal)', desc: 'Audit Trail & Rekonsiliasi PSAK 16 Read-Only' },
];

// T2B-3 — MASTER KATEGORI & ASET TETAP
// Domain `main_type` kini diseragamkan dengan kode kanonikal di
// server/taxonomy.ts (TNH/BGN/MSN/KDR/INV-F/INV-P/IT-H/IT-S/LNY) — satu
// vocabulary yang dipakai bersama oleh API, form aset, dan pelaporan PSAK 16.
// Label memuat istilah PSAK berbahasa Inggris agar konteks akuntansi tetap jelas.
export const ASSET_MAIN_TYPES = [
  { value: 'TNH', label: 'TNH — Tanah (LAND)', desc: 'Lahan kawasan Pasar Induk Beras Cipinang, lahan pergudangan & sentra produksi' },
  { value: 'BGN', label: 'BGN — Bangunan (BUILDING)', desc: 'Kantor Pusat Cipinang, komplek pergudangan beras induk, pos keamanan' },
  { value: 'MSN', label: 'MSN — Mesin & Peralatan (EQUIPMENT)', desc: 'Mesin pabrik pengolahan, forklift, jembatan timbang, genset, komputer' },
  { value: 'KDR', label: 'KDR — Kendaraan (VEHICLE)', desc: 'Truk logistik beras, mobil dinas operasional, sepeda motor lapangan' },
  { value: 'INV-F', label: 'INV-F — Inventaris Furniture (FURNITURE)', desc: 'Meja rapat, kursi ergonomis, lemari arsip, rak pallet gudang' },
  { value: 'INV-P', label: 'INV-P — Inventaris Peralatan (EQUIPMENT)', desc: 'Kompor, dispenser, AC, vacuum cleaner, APAR, toolkit bengkel' },
  { value: 'IT-H', label: 'IT-H — IT Hardware (EQUIPMENT)', desc: 'Laptop, PC, server, monitor, printer, jaringan & firewall' },
  { value: 'IT-S', label: 'IT-S — IT Software & Lisensi (LICENSE)', desc: 'Lisensi OS, Microsoft 365, software akuntansi ERP, antivirus' },
  { value: 'LNY', label: 'LNY — Aset Tetap Lainnya (OTHER)', desc: 'Genset cadangan, instalasi listrik, peralatan lab uji, aset khusus' },
];

export const GABAH_TAXONOMY_TYPES: { value: 'IT' | 'License' | 'General'; label: string; desc: string }[] = [
  { value: 'IT', label: 'IT (Modul Perangkat Keras Komputasi)', desc: 'Mengaktifkan form spesifikasi teknis (CPU, RAM, Storage, IP, MAC Address, Hostname, OS)' },
  { value: 'License', label: 'License (Modul Lisensi Digital Software)', desc: 'Mengaktifkan pengelolaan lisensi perangkat lunak, jumlah seat, serial key, dan masa aktif' },
  { value: 'General', label: 'General (Modul Inventaris Fisik / Fasilitas)', desc: 'Pengelolaan sarpras, mebel, kendaraan operasional, dan gedung dengan pelacakan fisik BAST' },
];

const DEFAULT_PERMISSIONS: RolePermissionRow[] = [
  { role: 'Admin GABAH', desc: 'Super Administrator', assets: 'Full Access', loans: 'Approve & Handover', tickets: 'All Categories', licenses: 'Full', reports: 'Full', audit: 'Full', admin: 'Full Control' },
  { role: 'IT', desc: 'Teknologi Informasi & Sistem', assets: 'Divisi IT', loans: 'Approve IT Aset', tickets: 'IT & License', licenses: 'Manage', reports: 'Divisi IT', audit: 'View IT', admin: 'No' },
  { role: 'GA', desc: 'General Affairs & Fasilitas', assets: 'Divisi GA', loans: 'Approve GA Aset', tickets: 'Fasilitas GA', licenses: 'Read', reports: 'Divisi GA', audit: 'View GA', admin: 'No' },
  { role: 'Sekretaris Direksi', desc: 'Sekretariat Direksi & Komisaris', assets: 'Aset Pribadi', loans: 'Request Pinjam', tickets: 'Buat Tiket', licenses: 'No', reports: 'No', audit: 'No', admin: 'No' },
  { role: 'Humas', desc: 'Humas & Protokoler Perusahaan', assets: 'Aset Pribadi', loans: 'Request Pinjam', tickets: 'Buat Tiket', licenses: 'No', reports: 'No', audit: 'No', admin: 'No' },
  { role: 'Supply Chain', desc: 'Armada & Pergudangan Beras', assets: 'Divisi SC', loans: 'Approve Truk/SC', tickets: 'Logistik SC', licenses: 'Read', reports: 'Divisi SC', audit: 'View SC', admin: 'No' },
  { role: 'PIBC', desc: 'Pasar Induk Beras Cipinang', assets: 'Divisi PIBC', loans: 'Approve Pasar', tickets: 'Operasional', licenses: 'Read', reports: 'Divisi PIBC', audit: 'View', admin: 'No' },
  { role: 'Karyawan', desc: 'Pegawai Operasional BUMD', assets: 'Aset Pribadi', loans: 'Request Pinjam', tickets: 'Buat Tiket Sendiri', licenses: 'No', reports: 'No', audit: 'No', admin: 'No' },
  { role: 'Auditor', desc: 'Satuan Pengawas Internal / BPKP', assets: 'Audit Only', loans: 'Audit History', tickets: 'Audit Trail', licenses: 'Audit', reports: 'Rekonsiliasi', audit: 'Full Read', admin: 'No' },
];

/**
 * Vocabulary otorisasi standar (template) per kolom matriks, diturunkan dari
 * DEFAULT_PERMISSIONS. Modal "Ubah Otorisasi" HARUS memakai dropdown dari
 * daftar ini (bukan input bebas) agar nilai matriks konsisten dan tidak
 * merusak tampilan/pemetaan hak akses.
 */
const PERMISSION_TEMPLATE_FIELDS: Record<keyof Omit<RolePermissionRow, 'role' | 'desc'>, string[]> = {
  assets: ['Full Access', 'Divisi IT', 'Divisi GA', 'Divisi SC', 'Divisi PIBC', 'Aset Pribadi', 'Audit Only', 'No'],
  loans: ['Approve & Handover', 'Approve IT Aset', 'Approve GA Aset', 'Approve Truk/SC', 'Approve Pasar', 'Request Pinjam', 'Audit History', 'No'],
  tickets: ['All Categories', 'IT & License', 'Fasilitas GA', 'Logistik SC', 'Operasional', 'Buat Tiket', 'Buat Tiket Sendiri', 'Audit Trail', 'No'],
  licenses: ['Full', 'Manage', 'Read', 'Audit', 'No'],
  reports: ['Full', 'Divisi IT', 'Divisi GA', 'Divisi SC', 'Divisi PIBC', 'Rekonsiliasi', 'No'],
  audit: ['Full', 'Full Read', 'View IT', 'View GA', 'View SC', 'View', 'No'],
  admin: ['Full Control', 'No'],
};

const DEFAULT_DIVISIONS: OrgDivision[] = [
  { code: 'SC', name: 'Supply Chain & Logistik', leader: 'Direktur Operasional', depts: ['Pergudangan Beras Induk', 'Armada Truk & Distribusi', 'Kualitas & Pengemasan'] },
  { code: 'PIBC', name: 'Pasar Induk Beras Cipinang', leader: 'Kepala Pasar Induk', depts: ['Pengelolaan Kios & Los', 'Ketertiban & Retribusi', 'Informasi Pasokan Beras'] },
  { code: 'IT', name: 'Teknologi Informasi & Sistem', leader: 'Manajer IT & Transformasi Digital', depts: ['Infrastruktur & Jaringan', 'Sistem ERP SAP & GABAH', 'Technical Support & Helpdesk'] },
  { code: 'GA', name: 'General Affairs & Fasilitas', leader: 'Manajer Umum', depts: ['Pemeliharaan Gedung & ME', 'Kendaraan Operasional Kantor', 'Keamanan & Kebersihan'] },
];

const DEFAULT_LOCATIONS: MasterLocation[] = [
  { id: 'loc-1', name: 'Kantor Pusat Food Station Cipinang', address: 'Jl. Pisangan Lama No. 1, Jakarta Timur', capacity: '120 Pegawai' },
  { id: 'loc-2', name: 'Gudang Beras Induk Blok A-D', address: 'Kawasan PIBC, Jakarta Timur', capacity: '48.000 Ton Beras' },
  { id: 'loc-3', name: 'Depo Armada & Transportasi', address: 'Pintu 3 Pasar Induk Cipinang', capacity: '35 Truk Fuso' },
  { id: 'loc-4', name: 'Data Center & Server Room', address: 'Gedung Utama Lt. 2, Cipinang', capacity: 'Tier 2 Redundant' }
];

const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  { id: 'rule-warranty', title: 'Peringatan Masa Garansi & Lisensi Expired', trigger: '30 hari & 7 hari sebelum tanggal kedaluwarsa', target: 'Admin GABAH & Divisi IT', status: 'Aktif', severity: 'warning', daysBefore: 30 },
  { id: 'rule-loan', title: 'Eskalasi Keterlambatan Peminjaman (Overdue Loan)', trigger: 'Melewati batas due date jam 17:00 WIB', target: 'Peminjam, Atasan, dan Admin Penanggung Jawab', status: 'Aktif', severity: 'critical', cutoffTime: '17:00' },
  { id: 'rule-sla', title: 'SLA Breach Warning Tiket Helpdesk', trigger: 'Sisa waktu SLA < 1 jam atau status open melebihi target', target: 'Teknisi yang ditugaskan & Koordinator IT/GA', status: 'Aktif', severity: 'critical', warningHours: 1 },
  { id: 'rule-bast', title: 'Pemberitahuan BAST & Serah Terima Selesai', trigger: 'Saat serah terima fisik aset disetujui', target: 'Peminjam & Tim Inventaris BUMD', status: 'Aktif', severity: 'info' },
];

export const AdministrationModal: React.FC<AdministrationModalProps> = ({
  isOpen,
  onClose,
  users,
  auditLogs,
  assets,
  loans,
  tickets,
  currentUser,
  activeRole,
  onUpdateUser,
  onCreateUser,
  onDeleteUser,
  showToast,
  onRefreshData
}) => {
  // Hak akses administrasi dibatasi HANYA untuk Super Admin ('Admin GABAH')
  const isCurrentUserAdmin = (activeRole === 'Admin GABAH') || (currentUser?.role === 'Admin GABAH');
  const currentRoleName = activeRole || currentUser?.role || 'Admin GABAH';
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // User Management State
  const [userList, setUserList] = useState<UserProfile[]>(users);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Edit User State
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isSubmittingEditUser, setIsSubmittingEditUser] = useState(false);
  // Import pegawai massal (CSV/Excel) state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    valid: { name: string; email: string; role: string; division: string; department: string; phone: string }[];
    errors: string[];
  } | null>(null);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const importFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [editUserData, setEditUserData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    division: OwnerDivision;
    department: string;
    job_level_code: string;
    unit_id: string;
    office_location_id: string;
    phone: string;
    is_active: boolean;
    telegram_chat_id: string;
    new_password: string;
  }>({
    name: '',
    email: '',
    role: 'Karyawan',
    division: 'SC',
    department: '',
    job_level_code: '',
    unit_id: '',
    office_location_id: '',
    phone: '',
    is_active: true,
    telegram_chat_id: '',
    new_password: '',
  });

  const [newUserData, setNewUserData] = useState<Partial<UserProfile>>({
    name: '',
    email: '',
    role: 'Karyawan',
    role_label: 'Pegawai Operasional',
    division: 'SC',
    department: 'Pergudangan & Distribusi'
  });

  useEffect(() => {
    if (users && users.length > 0) {
      setUserList(users);
    }
  }, [users]);

  // Master Data State
  const [categories, setCategories] = useState<any[]>([
    { code: 'IT-HLT', name: 'Hardware Laptop & PC', type: 'IT', loanable: true, total: 42, is_active: true },
    { code: 'IT-SRV', name: 'Server & Infrastructure', type: 'IT', loanable: false, total: 18, is_active: true },
    { code: 'SC-FLT', name: 'Armada Truk Beras Cipinang', type: 'SC', loanable: true, total: 24, is_active: true },
    { code: 'GA-BLD', name: 'Gedung & Fasilitas Pasar', type: 'GA', loanable: false, total: 31, is_active: true },
    { code: 'LIC-ENT', name: 'Lisensi ERP SAP & OS', type: 'License', loanable: false, total: 15, is_active: true },
  ]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    code: '',
    name: '',
    main_type: 'MSN',
    owner_division: 'IT',
    category_type: 'IT',
    description: '',
    is_loanable_by_default: true,
  });

  // Fetch live master data (categories, locations, divisions) from database
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [liveCats, liveLocs, liveDivs, liveJobLevels, liveOrgUnits, liveOffices, liveAssetLocs] = await Promise.all([
          gabahApi.getCategories().catch(() => []),
          gabahApi.getLocations().catch(() => []),
          gabahApi.getDivisions().catch(() => []),
          gabahApi.getJobLevels().catch(() => []),
          gabahApi.getOrgUnits().catch(() => []),
          gabahApi.getOfficeLocations().catch(() => []),
          gabahApi.getAssetLocations().catch(() => []),
        ]);
        if (Array.isArray(liveCats) && liveCats.length > 0) {
          const mapped = liveCats.map((c: any) => ({
            code: c.code,
            name: c.name,
            type: c.owner_division || (c.category_type === 'IT' ? 'IT' : 'GA'),
            main_type: c.main_type || 'LNY',
            owner_division: c.owner_division || 'IT',
            category_type: c.category_type || 'IT',
            // T2B-3: status aktif master kategori (disable, bukan hapus).
            is_active: c.is_active !== false,
            loanable: c.is_loanable_by_default ?? false,
            total: (assets || []).filter(a => (a.category_code === c.code || a.asset_number?.includes(c.code))).length,
            description: c.description || '',
          }));
          setCategories(mapped);
        }
        if (Array.isArray(liveLocs) && liveLocs.length > 0) {
          setLocations(liveLocs);
        }
        if (Array.isArray(liveDivs) && liveDivs.length > 0) {
          setDivisions(liveDivs);
        }
        // ORG-MODEL: masters terpisah jabatan/unit/lokasi kantor
        if (Array.isArray(liveJobLevels) && liveJobLevels.length > 0) setJobLevels(liveJobLevels);
        if (Array.isArray(liveOrgUnits) && liveOrgUnits.length > 0) setOrgUnits(liveOrgUnits);
        if (Array.isArray(liveOffices) && liveOffices.length > 0) setOfficeLocations(liveOffices);
        if (Array.isArray(liveAssetLocs)) setAssetLocations(liveAssetLocs);
      } catch (e) {
        console.warn('Notice loading master data:', e);
      }
    };
    if (isOpen) {
      fetchMasterData();
    }
  }, [isOpen, assets]);

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryData.code.trim() || !newCategoryData.name.trim()) {
      showToast('Kode kategori dan nama kategori wajib diisi.', 'warning');
      return;
    }
    try {
      setIsSubmittingCategory(true);
      const created = await gabahApi.createCategory({
        code: newCategoryData.code.trim().toUpperCase(),
        name: newCategoryData.name.trim(),
        main_type: newCategoryData.main_type,
        owner_division: newCategoryData.owner_division,
        category_type: newCategoryData.category_type,
        description: newCategoryData.description.trim(),
        is_loanable_by_default: newCategoryData.is_loanable_by_default,
      });

      setCategories(prev => [
        ...prev,
        {
          code: created.code,
          name: created.name,
          type: created.owner_division,
          main_type: created.main_type,
          owner_division: created.owner_division,
          category_type: created.category_type,
          loanable: created.is_loanable_by_default,
          is_active: created.is_active !== false,
          total: 0,
          description: created.description,
        }
      ]);
      setIsAddCategoryOpen(false);
      setNewCategoryData({
        code: '',
        name: '',
        main_type: 'MSN',
        owner_division: 'IT',
        category_type: 'IT',
        description: '',
        is_loanable_by_default: true,
      });
      showToast(`Kategori ${created.code} - ${created.name} berhasil ditambahkan!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan kategori.', 'warning');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const [locations, setLocations] = useState<MasterLocation[]>(() => {
    const saved = localStorage.getItem('gabah_master_locations');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_LOCATIONS;
  });
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<MasterLocation | null>(null);
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [newLocationData, setNewLocationData] = useState({ name: '', address: '', capacity: '' });
  const [editLocationData, setEditLocationData] = useState({ id: '', name: '', address: '', capacity: '' });

  // Categories Edit State
  const [categoryToEdit, setCategoryToEdit] = useState<any | null>(null);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [editCategoryData, setEditCategoryData] = useState({
    code: '',
    name: '',
    main_type: 'MSN',
    owner_division: 'IT',
    category_type: 'IT',
    description: '',
    is_loanable_by_default: true,
  });

  // Role & Permissions State
  const [permissions, setPermissions] = useState<RolePermissionRow[]>(() => {
    const saved = localStorage.getItem('gabah_role_permissions');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PERMISSIONS;
  });
  const [roleToEdit, setRoleToEdit] = useState<RolePermissionRow | null>(null);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [editRoleRow, setEditRoleRow] = useState<RolePermissionRow | null>(null);

  // Organization State
  // ORG-MODEL: master Jabatan/Level, Unit, dan Kantor/Lokasi (terpisah).
  const [jobLevels, setJobLevels] = useState<OrgJobLevel[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [officeLocations, setOfficeLocations] = useState<OrgOfficeLocation[]>([]);
  const [newJobLevelData, setNewJobLevelData] = useState({ code: '', label: '', order: '' });
  const [newOrgUnitData, setNewOrgUnitData] = useState({ name: '', division_code: 'Umum' });
  const [newOfficeData, setNewOfficeData] = useState({ name: '' });
  // T2B-2: master Lokasi Fisik Aset — hierarki sederhana (parent_id).
  const [assetLocations, setAssetLocations] = useState<any[]>([]);
  const [newAssetLocationData, setNewAssetLocationData] = useState({ name: '', parent_id: '' });
  const [isSubmittingOrgMaster, setIsSubmittingOrgMaster] = useState(false);

  const [divisions, setDivisions] = useState<OrgDivision[]>(() => {
    const saved = localStorage.getItem('gabah_org_divisions');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_DIVISIONS;
  });
  const [divisionToEdit, setDivisionToEdit] = useState<OrgDivision | null>(null);
  const [isEditDivisionOpen, setIsEditDivisionOpen] = useState(false);
  const [isAddDivisionOpen, setIsAddDivisionOpen] = useState(false);
  const [newDivisionData, setNewDivisionData] = useState({
    code: '',
    name: '',
    leader: '',
    initialDept: '',
  });
  const [newDeptInput, setNewDeptInput] = useState('');

  // Asset Numbering State
  const [numberingConfig, setNumberingConfig] = useState(() => {
    const saved = localStorage.getItem('gabah_numbering_config');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      prefixCorp: 'FS',
      format: '{DIV}-{CODE}-{YEAR}-{SEQ}',
      separator: '-',
      paddingDigits: 4,
      autoResetYearly: true
    };
  });
  const [isEditingNumbering, setIsEditingNumbering] = useState(false);
  const [tempNumberingConfig, setTempNumberingConfig] = useState(numberingConfig);
  const [testDiv, setTestDiv] = useState<OwnerDivision>('IT');
  const [testCode, setTestCode] = useState('HLT');
  const [simulatedNumber, setSimulatedNumber] = useState('IT-HLT-2026-0005');

  // Notification Rules State
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>(() => {
    const saved = localStorage.getItem('gabah_notification_rules');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_NOTIFICATION_RULES;
  });

  // Audit Search & Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 20;

  // P2#10: live numbering sequences (server snapshot) — no more hardcoded samples.
  const [liveSequences, setLiveSequences] = useState<Array<{ key: string; division: string; code: string; year: number; current: number }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    gabahApi.getNumberingSequences()
      .then(seq => { if (!cancelled) setLiveSequences(seq); })
      .catch(() => { /* keep null → UI shows honest "unavailable" state */ });
    return () => { cancelled = true; };
  }, []);

  // P2#11: CR-05 reminder subsystem overview (admin-only endpoint).
  const [reminderOverview, setReminderOverview] = useState<any>(null);
  const [reminderOverviewError, setReminderOverviewError] = useState<string>('');
  const refreshReminderOverview = () => {
    setReminderOverviewError('');
    gabahApi.getReminderOverview()
      .then(res => setReminderOverview(res))
      .catch((err: any) => setReminderOverviewError(err.message || 'Gagal memuat overview reminder'));
  };
  useEffect(() => {
    refreshReminderOverview();
  }, []);

  // System Settings State
  const [settingsForm, setSettingsForm] = useState(() => {
    const saved = localStorage.getItem('gabah_system_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      companyName: 'PT Food Station Tjipinang Jaya (Perseroda)',
      shortCode: 'GABAH',
      orgType: 'BUMD Pangan Pemerintah Provinsi DKI Jakarta',
      accountingStandard: 'PSAK 16 (Aset Tetap & Depresiasi Garis Lurus)',
      baseCurrency: 'IDR (Rupiah)',
      fiscalYear: '2026',
      capitalizationThreshold: '1000000',
      slaUrgentHours: 4,
      slaHighHours: 8,
      slaMediumHours: 24,
      slaLowHours: 48,
      autoBackupDaily: true,
      auditRetentionDays: 90
    };
  });

  // Health Check State
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    latency: number | null;
    timestamp: string;
    isChecking: boolean;
    persistence?: string;
    scheduler?: { enabled?: boolean; running?: boolean; intervalMs?: number; timezone?: string; lastRun?: string | null };
  }>({
    // Status awal: BELUM diperiksa — jangan mengarang angka latency/status.
    status: 'Belum Diperiksa',
    latency: null,
    timestamp: '',
    isChecking: false
  });

  // Master Location Handlers
  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationData.name.trim()) {
      showToast('Nama lokasi fasilitas wajib diisi', 'warning');
      return;
    }
    const newLoc: MasterLocation = {
      id: `loc-${Date.now()}`,
      name: newLocationData.name.trim(),
      address: newLocationData.address.trim() || 'Kawasan PIBC, Jakarta Timur',
      capacity: newLocationData.capacity.trim() || 'Fasilitas Operasional'
    };
    try {
      await gabahApi.createLocation(newLoc).catch(() => {});
    } catch {}
    const updated = [...locations, newLoc];
    setLocations(updated);
    localStorage.setItem('gabah_master_locations', JSON.stringify(updated));
    setIsAddLocationOpen(false);
    setNewLocationData({ name: '', address: '', capacity: '' });
    showToast(`Lokasi fasilitas "${newLoc.name}" berhasil ditambahkan!`, 'success');
  };

  const handleEditLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLocationData.name.trim()) {
      showToast('Nama lokasi fasilitas wajib diisi', 'warning');
      return;
    }
    try {
      await gabahApi.updateLocation(editLocationData.id, editLocationData).catch(() => {});
    } catch {}
    const updated = locations.map(l => l.id === editLocationData.id ? { ...l, ...editLocationData } : l);
    setLocations(updated);
    localStorage.setItem('gabah_master_locations', JSON.stringify(updated));
    setIsEditLocationOpen(false);
    setLocationToEdit(null);
    showToast(`Lokasi fasilitas "${editLocationData.name}" berhasil diperbarui!`, 'success');
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    try {
      await gabahApi.deleteLocation(id).catch(() => {});
    } catch {}
    const updated = locations.filter(l => l.id !== id);
    setLocations(updated);
    localStorage.setItem('gabah_master_locations', JSON.stringify(updated));
    showToast(`Lokasi fasilitas "${name}" berhasil dihapus.`, 'info');
  };

  // Categories Handlers (Edit & Delete)
  const handleEditCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit) return;
    // T2B-3: kunci payload disesuaikan dengan kontrak API — sebelumnya
    // `loanable` dikirim tetapi tidak pernah dibaca server (is_active/
    // is_loanable_by_default adalah nama field yang benar).
    const payload = {
      name: editCategoryData.name.trim(),
      main_type: editCategoryData.main_type,
      owner_division: editCategoryData.owner_division,
      category_type: editCategoryData.category_type,
      is_loanable_by_default: editCategoryData.is_loanable_by_default,
      description: editCategoryData.description.trim()
    };
    try {
      await gabahApi.updateCategory(categoryToEdit.code, payload).catch(() => {});
    } catch {}
    const updated = categories.map(c => c.code === categoryToEdit.code ? {
      ...c,
      name: payload.name,
      type: payload.owner_division,
      main_type: payload.main_type,
      owner_division: payload.owner_division,
      category_type: payload.category_type,
      loanable: payload.is_loanable_by_default,
      description: payload.description
    } : c);
    setCategories(updated);
    setIsEditCategoryOpen(false);
    setCategoryToEdit(null);
    showToast(`Kategori "${categoryToEdit.code}" berhasil diperbarui!`, 'success');
  };

  const handleDeleteCategory = async (code: string, name: string) => {
    const hasAssets = assets.some(a => a.category_code === code || a.asset_number?.includes(code));
    if (hasAssets) {
      showToast(`Kategori ${code} tidak dapat dihapus karena masih digunakan oleh unit aset aktif.`, 'warning');
      return;
    }
    try {
      await gabahApi.deleteCategory(code).catch(() => {});
    } catch {}
    setCategories(prev => prev.filter(c => c.code !== code));
    showToast(`Kategori ${code} - ${name} berhasil dihapus.`, 'info');
  };

  // T2B-3: toggle aktif/nonaktif master kategori — jalur utama "hapus" untuk
  // kategori yang sudah dipakai aset (disable, bukan hard-delete), sehingga
  // relasi & data aset historis tidak pernah rusak. Kategori nonaktif tetap
  // terbaca di semua tampilan, tetapi ditolak sebagai pilihan BARU (400).
  const handleToggleCategoryActive = async (code: string, name: string, nextActive: boolean) => {
    try {
      await gabahApi.updateCategory(code, { is_active: nextActive });
      setCategories(prev => prev.map(c => c.code === code ? { ...c, is_active: nextActive } : c));
      showToast(
        nextActive
          ? `Kategori ${code} - ${name} diaktifkan kembali.`
          : `Kategori ${code} - ${name} dinonaktifkan — tetap terbaca untuk aset historis, tidak dapat dipilih untuk aset baru.`,
        'info',
      );
    } catch (err: any) {
      showToast(err.message || `Gagal mengubah status kategori ${code}.`, 'warning');
    }
  };

  // Role Permissions Handlers
  const handleSaveRolePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleRow) return;
    const updated = permissions.map(p => p.role === editRoleRow.role ? editRoleRow : p);
    setPermissions(updated);
    localStorage.setItem('gabah_role_permissions', JSON.stringify(updated));
    setIsEditRoleOpen(false);
    setRoleToEdit(null);
    showToast(`Matriks hak akses untuk peran "${editRoleRow.role}" berhasil diperbarui!`, 'success');
  };

  const handleResetRolePermissions = () => {
    setPermissions(DEFAULT_PERMISSIONS);
    localStorage.removeItem('gabah_role_permissions');
    showToast('Matriks hak akses dikembalikan ke konfigurasi standar BUMD Food Station.', 'info');
  };

  // Organization Handlers
  const handleAddDivisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisionData.code.trim() || !newDivisionData.name.trim()) {
      showToast('Kode dan nama divisi wajib diisi.', 'warning');
      return;
    }
    const code = newDivisionData.code.trim().toUpperCase() as OwnerDivision;
    if (divisions.some(d => d.code === code)) {
      showToast(`Divisi dengan kode "${code}" sudah terdaftar.`, 'warning');
      return;
    }
    const newDiv: OrgDivision = {
      code,
      name: newDivisionData.name.trim(),
      leader: newDivisionData.leader.trim() || 'Pimpinan Divisi',
      depts: newDivisionData.initialDept.trim() ? [newDivisionData.initialDept.trim()] : ['Operasional & Administrasi']
    };
    try {
      await gabahApi.createDivision(newDiv).catch(() => {});
    } catch {}
    const updated = [...divisions, newDiv];
    setDivisions(updated);
    localStorage.setItem('gabah_org_divisions', JSON.stringify(updated));
    setIsAddDivisionOpen(false);
    setNewDivisionData({ code: '', name: '', leader: '', initialDept: '' });
    showToast(`Divisi baru ${newDiv.code} - ${newDiv.name} berhasil ditambahkan!`, 'success');
  };

  const handleDeleteDivision = async (code: string, name: string) => {
    const assetCount = assets.filter(a => a.owner_division === code).length;
    if (assetCount > 0) {
      showToast(`Divisi "${code}" tidak dapat dihapus karena masih menaungi ${assetCount} aset aktif.`, 'warning');
      return;
    }
    if (divisions.length <= 1) {
      showToast('Minimal harus ada satu divisi yang terdaftar.', 'warning');
      return;
    }
    try {
      await gabahApi.deleteDivision(code).catch(() => {});
    } catch {}
    const updated = divisions.filter(d => d.code !== code);
    setDivisions(updated);
    localStorage.setItem('gabah_org_divisions', JSON.stringify(updated));
    showToast(`Divisi "${code} - ${name}" berhasil dihapus.`, 'info');
  };

  // =========================
  // ORG-MODEL handlers: CRUD/disable master Jabatan, Unit, Kantor/Lokasi.
  // Jabatan/level TIDAK memberikan permission — hanya atribut organisasi.
  // =========================
  const handleAddJobLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobLevelData.code.trim() || !newJobLevelData.label.trim()) {
      showToast('Kode dan nama jabatan wajib diisi.', 'warning');
      return;
    }
    try {
      setIsSubmittingOrgMaster(true);
      const created = await gabahApi.createJobLevel({
        code: newJobLevelData.code.trim().toUpperCase(),
        label: newJobLevelData.label.trim(),
        order: newJobLevelData.order ? Number(newJobLevelData.order) : undefined,
      });
      setJobLevels(prev => [...prev, created].sort((a, b) => (a.order || 99) - (b.order || 99)));
      setNewJobLevelData({ code: '', label: '', order: '' });
      showToast(`Jabatan "${created.label}" berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambah jabatan.', 'warning');
    } finally {
      setIsSubmittingOrgMaster(false);
    }
  };

  const handleToggleJobLevel = async (code: string, nextActive: boolean) => {
    try {
      const updated = await gabahApi.updateJobLevel(code, { is_active: nextActive });
      setJobLevels(prev => prev.map(j => j.code === code ? updated : j));
      showToast(`Jabatan "${updated.label}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status jabatan.', 'warning');
    }
  };

  const handleAddOrgUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgUnitData.name.trim()) {
      showToast('Nama unit wajib diisi.', 'warning');
      return;
    }
    try {
      setIsSubmittingOrgMaster(true);
      const created = await gabahApi.createOrgUnit({
        name: newOrgUnitData.name.trim(),
        division_code: newOrgUnitData.division_code,
      });
      setOrgUnits(prev => [...prev, created]);
      setNewOrgUnitData({ name: '', division_code: 'Umum' });
      showToast(`Unit "${created.name}" berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambah unit.', 'warning');
    } finally {
      setIsSubmittingOrgMaster(false);
    }
  };

  const handleToggleOrgUnit = async (id: string, nextActive: boolean) => {
    try {
      const updated = await gabahApi.updateOrgUnit(id, { is_active: nextActive });
      setOrgUnits(prev => prev.map(u => u.id === id ? updated : u));
      showToast(`Unit "${updated.name}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status unit.', 'warning');
    }
  };

  const handleAddOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeData.name.trim()) {
      showToast('Nama lokasi kantor wajib diisi.', 'warning');
      return;
    }
    try {
      setIsSubmittingOrgMaster(true);
      const created = await gabahApi.createOfficeLocation({ name: newOfficeData.name.trim() });
      setOfficeLocations(prev => [...prev, created]);
      setNewOfficeData({ name: '' });
      showToast(`Lokasi kantor "${created.name}" berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambah lokasi kantor.', 'warning');
    } finally {
      setIsSubmittingOrgMaster(false);
    }
  };

  const handleToggleOffice = async (id: string, nextActive: boolean) => {
    try {
      const updated = await gabahApi.updateOfficeLocation(id, { is_active: nextActive });
      setOfficeLocations(prev => prev.map(l => l.id === id ? updated : l));
      showToast(`Lokasi "${updated.name}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status lokasi.', 'warning');
    }
  };

  // T2B-2: handler master Lokasi Fisik Aset (create + toggle aktif).
  const handleAddAssetLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetLocationData.name.trim()) {
      showToast('Nama lokasi fisik wajib diisi.', 'warning');
      return;
    }
    try {
      setIsSubmittingOrgMaster(true);
      const created = await gabahApi.createAssetLocation({
        name: newAssetLocationData.name.trim(),
        parent_id: newAssetLocationData.parent_id || null,
      });
      setAssetLocations(prev => [...prev, created]);
      setNewAssetLocationData({ name: '', parent_id: '' });
      showToast(`Lokasi fisik "${created.name}" berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambah lokasi fisik.', 'warning');
    } finally {
      setIsSubmittingOrgMaster(false);
    }
  };

  const handleToggleAssetLocation = async (id: string, nextActive: boolean) => {
    try {
      const updated = await gabahApi.updateAssetLocation(id, { is_active: nextActive });
      setAssetLocations(prev => prev.map(l => l.id === id ? updated : l));
      showToast(`Lokasi fisik "${updated.name}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status lokasi fisik.', 'warning');
    }
  };

  const handleSaveDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divisionToEdit) return;
    try {
      await gabahApi.updateDivision(divisionToEdit.code, divisionToEdit).catch(() => {});
    } catch {}
    const updated = divisions.map(d => d.code === divisionToEdit.code ? divisionToEdit : d);
    setDivisions(updated);
    localStorage.setItem('gabah_org_divisions', JSON.stringify(updated));
    setIsEditDivisionOpen(false);
    setDivisionToEdit(null);
    showToast(`Struktur divisi ${divisionToEdit.code} - ${divisionToEdit.name} berhasil disimpan!`, 'success');
  };

  const handleResetDivisions = () => {
    setDivisions(DEFAULT_DIVISIONS);
    localStorage.removeItem('gabah_org_divisions');
    showToast('Struktur divisi dikembalikan ke standar organisasi BUMD.', 'info');
  };

  // Numbering Config Handlers
  const handleSaveNumberingConfig = () => {
    setNumberingConfig(tempNumberingConfig);
    localStorage.setItem('gabah_numbering_config', JSON.stringify(tempNumberingConfig));
    setIsEditingNumbering(false);
    // Update live simulated number
    const seqPadded = String(5).padStart(tempNumberingConfig.paddingDigits, '0');
    setSimulatedNumber(`${testDiv}${tempNumberingConfig.separator}${testCode}${tempNumberingConfig.separator}2026${tempNumberingConfig.separator}${seqPadded}`);
    showToast('Format dan parameter sequence penomoran aset berhasil disimpan!', 'success');
  };

  // Notification Rules Handlers
  const handleToggleNotificationRule = (id: string) => {
    const updated = notificationRules.map(r => {
      if (r.id === id) {
        const nextStatus: 'Aktif' | 'Nonaktif' = r.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
        return { ...r, status: nextStatus };
      }
      return r;
    });
    setNotificationRules(updated);
    localStorage.setItem('gabah_notification_rules', JSON.stringify(updated));
    const target = updated.find(r => r.id === id);
    showToast(`Aturan "${target?.title}" diubah menjadi: ${target?.status}`, 'info');
  };

  // System Settings Handlers
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gabah_system_settings', JSON.stringify(settingsForm));
    showToast('Parameter tampilan panel administrasi tersimpan (local browser).', 'success');
  };

  // P1#1: Rekonsiliasi INTEGRITAS DATA NYATA (bukan toast palsu).
  // Memeriksa konsistensi referensi lintas data pada datastore aktif:
  // aset tanpa kategori valid, tiket tanpa reporter valid, pinjaman
  // tanpa aset/peminjam valid, dan nomor aset yang melanggar format kanonikal.
  const handleSapReconciliation = () => {
    const validCodes = new Set(categories.map(c => c.code));
    const orphanAssets = assets.filter(a => a.category_code && !validCodes.has(a.category_code));
    const invalidNumberAssets = assets.filter(a => {
      const n = a.asset_number || '';
      if (!n) return false;
      const parts = n.split('-');
      return parts.length !== 4 || !/\d{4}$/.test(parts[3] || '');
    });
    const validUserIds = new Set(userList.map(u => u.id));
    const validAssetIds = new Set(assets.map(a => a.id));
    const orphanTickets = tickets.filter(t => !validUserIds.has(t.reporter_id));
    const orphanLoans = loans.filter(l => !validUserIds.has(l.borrower_id) || (l.asset_id && !validAssetIds.has(l.asset_id)));

    const issues = [
      { label: 'Aset dengan kode kategori tidak terdaftar di master', items: orphanAssets },
      { label: 'Nomor aset tidak sesuai format kanonikal DIV-CODE-YEAR-SEQ', items: invalidNumberAssets },
      { label: 'Tiket dengan reporter tidak valid', items: orphanTickets },
      { label: 'Peminjaman dengan peminjam/aset tidak valid', items: orphanLoans },
    ];
    const totalIssues = issues.reduce((s, g) => s + g.items.length, 0);

    if (totalIssues === 0) {
      showToast(`Integritas data 100% konsisten: ${assets.length} aset, ${loans.length} peminjaman, ${tickets.length} tiket diperiksa — 0 anomali.`, 'success');
    } else {
      const detail = issues.filter(g => g.items.length > 0).map(g => `${g.items.length} ${g.label.toLowerCase()}`).join('; ');
      showToast(`Rekonsiliasi menemukan ${totalIssues} anomali: ${detail}. Ekspor JSON aset untuk analisis lanjutan.`, 'warning');
      exportDataJson('gabah_reconciliation_anomalies', {
        generated_at: new Date().toISOString(),
        summary: issues.map(g => ({ check: g.label, count: g.items.length, samples: g.items.slice(0, 20) })),
      });
    }
  };

  // Audit Log CSV Export
  const exportAuditLogsCsv = () => {
    const headers = ['ID', 'Waktu', 'Pengguna', 'Peran', 'Aksi', 'Entitas', 'Entitas ID', 'Rincian Perubahan', 'Alamat IP'];
    const rows = auditLogs.map(l => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${(l.user_name || '').replace(/"/g, '""')}"`,
      `"${l.user_role || ''}"`,
      `"${l.action || ''}"`,
      `"${l.entity || ''}"`,
      `"${l.entity_id || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || '-'}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gabah_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Audit Log format CSV berhasil diunduh untuk kebutuhan audit eksternal!', 'success');
  };

  // Full Database Backup Export
  const handleFullSystemBackup = () => {
    const backupBundle = {
      app: 'GABAH Enterprise Engine',
      company: settingsForm.companyName,
      backup_timestamp: new Date().toISOString(),
      version: '2026.1.0-ENTERPRISE',
      data: {
        users: userList,
        assets,
        loans,
        tickets,
        categories,
        locations,
        divisions,
        permissions,
        numbering_config: numberingConfig,
        notification_rules: notificationRules,
        settings: settingsForm,
        audit_logs_count: auditLogs.length
      }
    };
    exportDataJson('gabah_full_system_backup', backupBundle);
  };

  if (!isOpen) return null;

  const adminMenuCards = [
    { id: 'users' as AdminSection, label: 'User Management', description: 'Kelola pengguna, peranan, divisi, dan sandi sementara', icon: Users, badge: `${userList.length} User` },
    { id: 'roles' as AdminSection, label: 'Role & Permission', description: 'Matriks otorisasi per modul & pembatasan scope divisi', icon: LockKeyhole, badge: `${DEFAULT_PERMISSIONS.length} Roles` },
    { id: 'organization' as AdminSection, label: 'Organization', description: 'Divisi operasional Food Station & struktur departemen', icon: Building2, badge: `${divisions.length} Divisi` },
    { id: 'org_masters' as AdminSection, label: 'Jabatan, Unit & Lokasi', description: 'Master terpisah: Jabatan/Level, Unit, dan Kantor/Lokasi penempatan', icon: Network, badge: `${jobLevels.length} Jabatan` },
    { id: 'master_data' as AdminSection, label: 'Master Data', description: 'Kategori aset, master lokasi gedung PIBC, dan SLA Helpdesk', icon: Database, badge: `${categories.length} Kategori` },
    { id: 'numbering' as AdminSection, label: 'Asset Numbering', description: 'Format {DIV}-{CODE}-{YEAR}-{SEQ} & simulator sequence', icon: Hash, badge: 'Auto Sync' },
    { id: 'notifications' as AdminSection, label: 'Notification Center', description: 'Konfigurasi rule pengingat masa garansi, overdue loan, & SLA', icon: Bell, badge: 'Aktif' },
    { id: 'audit_log' as AdminSection, label: 'Audit Log', description: 'Rekam jejak aktivitas sistem, perubahan data, dan IP address', icon: ScrollText, badge: `${auditLogs.length} Log` },
    { id: 'settings' as AdminSection, label: 'System Settings', description: 'Parameter BUMD, standar PSAK 16, dan kebijakan retensi', icon: Settings2, badge: 'Terkonfigurasi' },
    { id: 'data_admin' as AdminSection, label: 'Data Administration', description: 'Export data lengkap, snapshot, dan audit rekonsiliasi SAP', icon: FileSpreadsheet, badge: 'PSAK Ready' },
    { id: 'health' as AdminSection, label: 'System Health', description: 'Status live API, koneksi database, dan memori container', icon: HeartPulse, badge: 'Healthy' },
  ];

  // Handle User Add
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email) {
      showToast('Nama dan email wajib diisi', 'warning');
      return;
    }
    try {
      setIsSubmittingUser(true);
      const created = await gabahApi.createUser({
        name: newUserData.name,
        email: newUserData.email,
        role: newUserData.role,
        division: newUserData.division,
        department: newUserData.department,
        phone: newUserData.phone || ''
      });

      setUserList(prev => [created, ...prev.filter(u => u.id !== created.id)]);
      if (onCreateUser) onCreateUser(created);
      setIsAddUserOpen(false);
      showToast(`Pengguna ${created.name} (${created.role}) berhasil ditambahkan ke database!`, 'success');
      setNewUserData({
        name: '',
        email: '',
        role: 'Karyawan',
        role_label: 'Pegawai Operasional',
        division: 'SC',
        department: 'Pergudangan & Distribusi'
      });
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`Gagal menambahkan pengguna: ${err.message}`, 'warning');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Handle Open Edit User
  const handleOpenEditUser = (user: UserProfile) => {
    setUserToEdit(user);
    setEditUserData({
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      division: (user.division as OwnerDivision) || 'SC',
      department: user.department || '',
      job_level_code: (user as any).job_level_code || '',
      unit_id: (user as any).unit_id || '',
      office_location_id: (user as any).office_location_id || '',
      phone: user.phone || '',
      is_active: user.is_active !== undefined ? user.is_active : true,
      telegram_chat_id: user.telegram_chat_id || '',
      new_password: '',
    });
    setIsEditUserOpen(true);
  };

  // ============ IMPORT MASSAL PEGAWAI (CSV/Excel) ============
  const validImportRoles = SYSTEM_ROLES.map(r => r.value as string);
  const validImportDivisions = divisions.map(d => String(d.code));

  const handleImportFilePicked = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseUsersImportCsv(text, validImportRoles, validImportDivisions);
      setImportPreview(parsed);
      if (parsed.valid.length === 0 && parsed.errors.length > 0) {
        showToast(`Tidak ada baris valid. Periksa: ${parsed.errors[0]}`, 'warning');
      }
    } catch {
      showToast('Gagal membaca berkas. Pastikan formatnya CSV.', 'warning');
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0) {
      showToast('Tidak ada data valid untuk diimpor.', 'warning');
      return;
    }
    try {
      setIsSubmittingImport(true);
      const res: any = await gabahApi.bulkImportUsers(importPreview.valid);
      const created = res?.created ?? 0;
      const updated = res?.updated ?? 0;
      const failed = res?.failed ?? 0;
      const serverErrors: string[] = res?.errors || [];
      const serverWarnings: string[] = res?.warnings || [];
      setUserList(prev => {
        const byEmail = new Map<string, UserProfile>();
        for (const u of prev) byEmail.set(String(u.email).toLowerCase(), u);
        for (const u of (res?.users || []) as UserProfile[]) {
          byEmail.set(String(u.email).toLowerCase(), u);
        }
        return Array.from(byEmail.values());
      });
      setImportPreview(null);
      setIsImportOpen(false);
      showToast(
        `Impor selesai: ${created} akun baru dibuat, ${updated} profil diperbarui${failed > 0 ? `, ${failed} baris gagal` : ''}.`,
        failed > 0 ? 'warning' : 'success'
      );
      if (serverWarnings.length > 0) {
        showToast(serverWarnings.slice(0, 3).join(' | '), 'info');
      }
      if (serverErrors.length > 0) {
        // Tampilkan 3 error pertama untuk perbaikan berkas
        showToast(serverErrors.slice(0, 3).join(' | '), 'warning');
      }
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`Gagal impor: ${err.message}`, 'warning');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // Handle Edit User Submit
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    try {
      setIsSubmittingEditUser(true);
      const payload: any = {
        name: editUserData.name.trim(),
        email: editUserData.email.trim(),
        role: editUserData.role,
        division: editUserData.division,
        department: editUserData.department.trim(),
        phone: editUserData.phone.trim(),
        is_active: editUserData.is_active,
        // ORG-MODEL: atribut jabatan/unit/lokasi independen dari role
        job_level_code: editUserData.job_level_code || '',
        unit_id: editUserData.unit_id || '',
        office_location_id: editUserData.office_location_id || '',
        // Admin-managed Telegram chat id untuk pengiriman reminder (CR-05).
        telegram_chat_id: editUserData.telegram_chat_id.trim() || undefined,
      };
      if (editUserData.new_password && editUserData.new_password.trim()) {
        payload.password = editUserData.new_password.trim();
      }

      const res = await gabahApi.updateUser(userToEdit.id, payload);
      const updatedUser: UserProfile = { ...userToEdit, ...res };
      setUserList(prev => prev.map(u => u.id === userToEdit.id ? updatedUser : u));
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      showToast(`Data pengguna ${updatedUser.name} berhasil diperbarui!`, 'success');
      setIsEditUserOpen(false);
      setUserToEdit(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`Gagal memperbarui pengguna: ${err.message}`, 'warning');
    } finally {
      setIsSubmittingEditUser(false);
    }
  };

  // Handle User Delete (Always allows force delete with auto-release)
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setIsDeletingUser(true);
      const res = await gabahApi.deleteUser(userToDelete.id, true);
      setUserList(prev => prev.filter(u => u.id !== userToDelete.id));
      if (onDeleteUser) onDeleteUser(userToDelete.id);
      showToast(res.message || `Pengguna ${userToDelete.name} berhasil dihapus.`, 'success');
      setUserToDelete(null);
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus pengguna.', 'warning');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Run health check — MURNI dari respons /api/health riil (tanpa nilai default palsu).
  const pingHealthCheck = async () => {
    setHealthStatus(prev => ({ ...prev, isChecking: true }));
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const latency = Math.round(performance.now() - start);
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setHealthStatus({
          status: 'Operational (200 OK)',
          latency,
          timestamp: new Date().toLocaleTimeString(),
          isChecking: false,
          persistence: typeof body.persistence === 'string' ? body.persistence : undefined,
          scheduler: body.scheduler && typeof body.scheduler === 'object' ? body.scheduler : undefined,
        });
        showToast(`API Server sehat! Waktu respon: ${latency} ms`, 'success');
      } else {
        setHealthStatus({ status: 'Degraded', latency, timestamp: new Date().toLocaleTimeString(), isChecking: false });
        showToast('API mengembalikan respon tidak normal', 'warning');
      }
    } catch {
      setHealthStatus({ status: 'Error Menghubungi API', latency: null, timestamp: new Date().toLocaleTimeString(), isChecking: false });
      showToast('Gagal menghubungi backend API', 'warning');
    }
  };

  // Health snapshot awal sekali per render modal (sekali fetch, tanpa toast).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = performance.now();
      try {
        const res = await fetch('/api/health');
        const latency = Math.round(performance.now() - start);
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setHealthStatus({
            status: 'Operational (200 OK)',
            latency,
            timestamp: new Date().toLocaleTimeString(),
            isChecking: false,
            persistence: typeof body.persistence === 'string' ? body.persistence : undefined,
            scheduler: body.scheduler && typeof body.scheduler === 'object' ? body.scheduler : undefined,
          });
        }
      } catch {
        /* biarkan state default: belum diperiksa — jangan mengarang status */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // P1#2: Reset sandi NYATA — minta server menerbitkan sandi sementara CSPRNG
  // (server meng-hash & menyimpannya), lalu tampilkan SEKALI untuk disampaikan
  // out-of-band. Tanpa provider email yang terkonfigurasi, klaim "link email
  // terkirim" adalah palsu — sehingga UI menampilkan sandinya secara eksplisit.
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserProfile | null>(null);
  const [tempIssuedPassword, setTempIssuedPassword] = useState<string | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const handleRealPasswordReset = async () => {
    if (!passwordResetTarget) return;
    try {
      setIsSubmittingReset(true);
      const res = await fetch(`/api/users/${passwordResetTarget.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gabah_auth_token') || ''}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.data?.temp_password) {
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      setTempIssuedPassword(body.data.temp_password);
      showToast(`Sandi sementara untuk ${passwordResetTarget.name} diterbitkan server. Sampaikan via kanal aman.`, 'success');
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      showToast(`Gagal reset sandi: ${err.message}`, 'warning');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Export JSON helper
  const exportDataJson = (filename: string, data: any) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`File ${filename} berhasil diekspor!`);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-[3px] flex items-start justify-center p-3 sm:p-5 lg:p-8 overflow-y-auto">
      <section className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#4ABDAC]/10 via-white to-[#F7B733]/10 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4ABDAC] text-white flex items-center justify-center shadow-md shadow-[#4ABDAC]/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900">Administration Control Panel</h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 bg-emerald-100 text-emerald-800 border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SUPER ADMIN (FULL ACCESS)</span>
                  <span className="text-emerald-400">•</span>
                  <span className="text-emerald-950 font-extrabold">{currentUser?.name || 'Budi Santoso'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                PT Food Station Tjipinang Jaya · Tata kelola sistem, otorisasi, master data, dan pemantauan layanan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSection !== 'overview' && (
              <button
                onClick={() => setActiveSection('overview')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5"
              >
                <span>Semua Menu</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors"
              aria-label="Tutup Administration"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Governance & Access Level Notice */}
        <div className="px-6 pt-3 shrink-0">
          {isCurrentUserAdmin ? (
            <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3 flex-wrap shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-emerald-950">
                    Otoritas Penuh Super Administrator (Admin GABAH)
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Anda berwenang mengedit pengguna, master kategori &amp; lokasi, struktur divisi, penomoran aset, aturan notifikasi, dan parameter sistem. <b>Audit Trail</b> tetap dipertahankan permanen (WORM immutable) untuk kepatuhan regulasi.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                  Akses Edit: AKTIF
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-purple-50/90 border border-purple-200 text-xs text-purple-900 flex items-center justify-between gap-3 flex-wrap shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <LockKeyhole className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-purple-950">
                    Mode Verifikasi &amp; Pemeriksaan (Hanya-Baca / Read-Only)
                  </div>
                  <div className="text-[11px] text-purple-700 mt-0.5">
                    Anda masuk sebagai <b>{activeRole || currentUser?.role || 'Auditor'}</b>. Anda dapat memverifikasi seluruh konfigurasi, struktur organisasi, SLA, dan mengunduh data audit. Perubahan data hanya dapat dieksekusi oleh <b>Admin GABAH</b>.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-200 text-purple-900 border border-purple-300">
                  Akses Tulis: TERKUNCI (READ ONLY)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Nav Tabs */}
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/70 overflow-x-auto flex items-center gap-1 shrink-0 text-xs font-medium text-slate-600">
          <button
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeSection === 'overview' ? 'bg-[#4ABDAC] text-white font-bold shadow-xs' : 'hover:bg-slate-200/60'
            }`}
          >
            Dashboard Overview
          </button>
          <span className="text-slate-300">|</span>
          {adminMenuCards.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeSection === item.id ? 'bg-[#4ABDAC] text-white font-bold shadow-xs' : 'hover:bg-slate-200/60'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Main Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          {/* =========================================================
              VIEW: OVERVIEW (CARD GRID)
              ========================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {adminMenuCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className="text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#4ABDAC] hover:shadow-lg hover:shadow-[#4ABDAC]/10 transition-all group flex flex-col justify-between active:scale-[0.99] cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#4ABDAC] group-hover:text-white text-[#4ABDAC] border border-slate-200 flex items-center justify-center transition-colors">
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#4ABDAC]/15 group-hover:text-[#206f65] transition-colors">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 group-hover:text-[#206f65] transition-colors">
                          {item.label}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-[#4ABDAC] group-hover:text-[#206f65]">
                        <span>Buka Konfigurasi</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Status Banner */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-900">Sistem Berjalan Normal & Terproteksi</h4>
                    <p className="text-xs text-emerald-700">
                      GABAH Enterprise Engine tersinkronisasi dengan tata kelola PSAK 16 dan otorisasi multi-role BUMD.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={pingHealthCheck}
                    disabled={healthStatus.isChecking}
                    className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.isChecking ? 'animate-spin' : ''}`} />
                    <span>Ping API ({healthStatus.latency !== null ? `${healthStatus.latency} ms` : '…'})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 1. USER MANAGEMENT
             ========================================================= */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="text-base font-black text-slate-900">User Management</h3>
                  <p className="text-xs text-slate-500">Kelola akun pegawai, penetapan peran (RBAC), dan sandi akses</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama atau email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#4ABDAC] w-56"
                    />
                  </div>
                  <select
                    value={userRoleFilter}
                    onChange={e => setUserRoleFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#4ABDAC]"
                  >
                    <option value="all">Semua Peran ({SYSTEM_ROLES.length})</option>
                    {SYSTEM_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {isCurrentUserAdmin ? (
                    <>
                      <button
                        onClick={() => setIsImportOpen(v => !v)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        title="Impor massal pegawai dari berkas CSV / Excel (upsert per email: akun baru dibuat, profil akun lama diperbarui)"
                      >
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Import CSV</span>
                      </button>
                      <button
                        onClick={() => exportUsersToCsv(userList)}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                        title="Unduh daftar pegawai sebagai CSV siap Excel (juga bisa dipakai sebagai template impor)"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={() => setIsAddUserOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold hover:bg-[#3ba393] flex items-center gap-1.5 shadow-sm shadow-[#4ABDAC]/20 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Pengguna</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5" title="Hanya Admin GABAH yang berhak mengimpor data pegawai">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span>Import CSV (Terkunci)</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed" title="Hanya Admin GABAH yang berhak menambah akun pengguna">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span>Tambah Pengguna (Terkunci)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Import Pegawai Massal (CSV/Excel) Panel */}
              {isImportOpen && (
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      Import Massal Data Pegawai (CSV / Excel)
                    </h4>
                    <button type="button" onClick={() => { setIsImportOpen(false); setImportPreview(null); }} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Tidak perlu input karyawan satu per satu: unduh template, isi di Excel, lalu unggah di sini.
                    <b> Email yang sudah terdaftar</b> akan <b>diperbarui</b> (nama, divisi, departemen, telepon, peran) tanpa mengubah sandi;
                    <b> email baru</b> otomatis dibuatkan akun (sandi awal diterbitkan server, sampaikan via kanal aman).
                    Setelah masuk, setiap pegawai tetap dapat diedit/dihapus satu per satu seperti biasa.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadUsersImportTemplate}
                      className="px-3 py-1.5 rounded-xl bg-white border border-blue-300 text-blue-800 text-xs font-bold hover:bg-blue-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Template CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => importFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Pilih Berkas CSV/Excel</span>
                    </button>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".csv,text/csv,.txt"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleImportFilePicked(f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {importPreview && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {importPreview.valid.length} baris siap diimpor
                        </span>
                        {importPreview.errors.length > 0 && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                            {importPreview.errors.length} baris bermasalah (dilewati)
                          </span>
                        )}
                      </div>
                      {importPreview.errors.length > 0 && (
                        <ul className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 list-disc list-inside max-h-24 overflow-y-auto">
                          {importPreview.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                      {importPreview.valid.length > 0 && (
                        <div className="max-h-44 overflow-y-auto rounded-xl border border-blue-200 bg-white">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                              <tr>
                                <th className="px-3 py-2">Nama</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2">Peran</th>
                                <th className="px-3 py-2">Divisi</th>
                                <th className="px-3 py-2">Departemen</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {importPreview.valid.slice(0, 50).map((r, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 font-semibold text-slate-800">{r.name}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.email}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.role}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.division || '-'}</td>
                                  <td className="px-3 py-1.5 text-slate-600">{r.department || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importPreview.valid.length > 50 && (
                            <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100">
                              …dan {importPreview.valid.length - 50} baris lainnya
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={isSubmittingImport || importPreview.valid.length === 0}
                        onClick={handleConfirmImport}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isSubmittingImport ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mengimpor…</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Proses Impor ({importPreview.valid.length} pegawai)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Add User Form Modal */}
              {isAddUserOpen && (
                <form onSubmit={handleAddUserSubmit} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">Form Tambah Pengguna Baru</h4>
                    <button type="button" onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Nama Lengkap</label>
                      <input
                        type="text"
                        required
                        value={newUserData.name}
                        onChange={e => setNewUserData({ ...newUserData, name: e.target.value })}
                        placeholder="Contoh: Rian Pratama, S.T."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Email Kantor</label>
                      <input
                        type="email"
                        required
                        value={newUserData.email}
                        onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                        placeholder="rian@foodstation.co.id"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Peran Akses (Role)</label>
                      <select
                        value={newUserData.role}
                        onChange={e => {
                          const r = e.target.value as UserRole;
                          const found = SYSTEM_ROLES.find(x => x.value === r);
                          setNewUserData({ ...newUserData, role: r, role_label: found?.label || r });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                      >
                        {SYSTEM_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Divisi</label>
                      <select
                        value={newUserData.division}
                        onChange={e => setNewUserData({ ...newUserData, division: e.target.value as OwnerDivision })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                      >
                        {divisions.map(d => (
                          <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Departemen</label>
                      <input
                        type="text"
                        value={newUserData.department}
                        onChange={e => setNewUserData({ ...newUserData, department: e.target.value })}
                        placeholder="Contoh: Distribusi Beras"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Nomor Telepon / WhatsApp</label>
                      <input
                        type="text"
                        value={newUserData.phone || ''}
                        onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                        placeholder="0812xxxxxxxx"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      Sandi awal dibuat otomatis oleh server (CSPRNG) dan dikirim out-of-band oleh Administrator — tidak ditampilkan di UI.
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSubmittingUser}
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-600"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingUser}
                      className="px-4 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold shadow-xs hover:bg-[#3ba393] disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {isSubmittingUser ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <span>Simpan Pengguna</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Nama & Profil</th>
                      <th className="px-4 py-3">Peran (Role)</th>
                      <th className="px-4 py-3">Divisi & Departemen</th>
                      <th className="px-4 py-3">Sandi Sementara</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userList
                      .filter(u => {
                        const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
                        const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
                        return matchSearch && matchRole;
                      })
                      .map(user => (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                                alt={user.name}
                                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                              />
                              <div>
                                <div className="font-bold text-slate-800">{user.name}</div>
                                <div className="text-[11px] text-slate-400">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                user.role === 'Admin GABAH'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : user.role === 'IT'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : user.role === 'GA'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : user.role === 'Supply Chain'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : user.role === 'Auditor'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : user.role === 'PIBC'
                                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                                  : user.role === 'Sekretaris Direksi'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : user.role === 'Humas'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {user.role}
                              </span>
                              {user.is_active === false && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-rose-50 text-rose-700 border-rose-200" title="Akun dinonaktifkan — tidak dapat login">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-700">{user.division || '-'}</div>
                            <div className="text-[11px] text-slate-400">{user.department}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            ********
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isCurrentUserAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    title={`Edit data ${user.name}`}
                                    onClick={() => handleOpenEditUser(user)}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-600" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    title={`Terbitkan sandi sementara untuk ${user.name}`}
                                    onClick={() => { setPasswordResetTarget(user); setTempIssuedPassword(null); }}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer"
                                  >
                                    Reset Sandi
                                  </button>
                                  <button
                                    type="button"
                                    title={`Hapus pengguna ${user.name}`}
                                    onClick={() => setUserToDelete(user)}
                                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                  <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Hanya-Baca</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Edit User Modal */}
              {isEditUserOpen && userToEdit && (
                <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pencil className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Edit Data Pengguna</h4>
                          <p className="text-xs text-slate-500">ID: {userToEdit.id} · Perbarui profil dan hak akses</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsEditUserOpen(false); setUserToEdit(null); }}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleEditUserSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">Nama Lengkap *</label>
                          <input
                            type="text"
                            required
                            value={editUserData.name}
                            onChange={e => setEditUserData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Contoh: Budi Santoso"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">Email Kantor (Login) *</label>
                          <input
                            type="email"
                            required
                            value={editUserData.email}
                            onChange={e => setEditUserData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="nama@foodstation.co.id"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Peran Akses (Role) *</label>
                          <select
                            value={editUserData.role}
                            onChange={e => setEditUserData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            {SYSTEM_ROLES.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Divisi Utama *</label>
                          <select
                            value={editUserData.division}
                            onChange={e => setEditUserData(prev => ({ ...prev, division: e.target.value as OwnerDivision }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            {divisions.map(d => (
                              <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Departemen / Unit</label>
                          <input
                            type="text"
                            value={editUserData.department}
                            onChange={e => setEditUserData(prev => ({ ...prev, department: e.target.value }))}
                            list="department-suggestions"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Contoh: Operasional Beras SPHP"
                          />
                          <datalist id="department-suggestions">
                            {(divisions.find(d => d.code === editUserData.division)?.depts || []).map(d => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Nomor Telepon / WhatsApp</label>
                          <input
                            type="text"
                            value={editUserData.phone}
                            onChange={e => setEditUserData(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="0812xxxxxxxx"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            Telegram Chat ID <span className="text-slate-400 font-normal">(opsional, untuk reminder)</span>
                          </label>
                          <input
                            type="text"
                            value={editUserData.telegram_chat_id}
                            onChange={e => setEditUserData(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Contoh: 123456789"
                          />
                          <p className="text-[10px] text-slate-400">Dipakai engine reminder kontrak (CR-05) untuk pengiriman Telegram ke user ini.</p>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">
                            Ubah Kata Sandi Baru <span className="text-slate-400 font-normal">(Kosongkan bila tidak diubah)</span>
                          </label>
                          <input
                            type="password"
                            value={editUserData.new_password}
                            onChange={e => setEditUserData(prev => ({ ...prev, new_password: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Minimal 6 karakter"
                          />
                        </div>

                        {/* ORG-MODEL: atribut jabatan/unit/lokasi — independen dari role */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Jabatan / Level</label>
                          <select
                            value={editUserData.job_level_code || ''}
                            onChange={e => setEditUserData(prev => ({ ...prev, job_level_code: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            <option value="">— Tidak ditentukan —</option>
                            {jobLevels.filter(j => j.is_active || j.code === editUserData.job_level_code).map(j => (
                              <option key={j.code} value={j.code}>{j.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400">Atribut organisasi — tidak mengubah permission/role.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Unit / Bagian</label>
                          <select
                            value={editUserData.unit_id || ''}
                            onChange={e => setEditUserData(prev => ({ ...prev, unit_id: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            <option value="">— Tidak ditentukan —</option>
                            {orgUnits.filter(u => u.is_active || u.id === editUserData.unit_id).map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.division_code})</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400">Unit ≠ role: pegawai Staf dapat berada di unit mana pun.</p>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-slate-700">Lokasi / Kantor Penempatan</label>
                          <select
                            value={editUserData.office_location_id || ''}
                            onChange={e => setEditUserData(prev => ({ ...prev, office_location_id: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            <option value="">— Tidak ditentukan —</option>
                            {officeLocations.filter(l => l.is_active || l.id === editUserData.office_location_id).map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400">Lokasi penempatan tidak memengaruhi owner aset, asset number, atau permission.</p>
                        </div>

                        <div className="space-y-1.5 md:col-span-2 pt-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editUserData.is_active}
                              onChange={e => setEditUserData(prev => ({ ...prev, is_active: e.target.checked }))}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-800">Akun Aktif (Dapat Login & Melakukan Transaksi)</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isSubmittingEditUser}
                          onClick={() => { setIsEditUserOpen(false); setUserToEdit(null); }}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingEditUser}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                        >
                          {isSubmittingEditUser ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan Perubahan</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete User Confirmation Modal */}
              {userToDelete && (() => {
                const activeLoansCount = loans.filter(
                  l => l.borrower_id === userToDelete.id && ['pending_approval', 'approved', 'borrowed'].includes(l.status)
                ).length;
                const assignedAssetsCount = assets.filter(
                  a => a.assigned_to?.id === userToDelete.id && a.status === 'assigned'
                ).length;
                const hasBlockers = activeLoansCount > 0 || assignedAssetsCount > 0;
                const isOnlySuperAdmin = userToDelete.role === 'Admin GABAH' && userList.filter(u => u.role === 'Admin GABAH').length <= 1;

                return (
                  <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Hapus Pengguna</h4>
                          <p className="text-xs text-slate-500">Konfirmasi penghapusan akun dari sistem GABAH</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={userToDelete.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                            alt={userToDelete.name}
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                          />
                          <div>
                            <div className="font-bold text-sm text-slate-800">{userToDelete.name}</div>
                            <div className="text-xs text-slate-500">{userToDelete.email}</div>
                            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">{userToDelete.role} · Divisi {userToDelete.division || 'Umum'}</div>
                          </div>
                        </div>
                      </div>

                      {isOnlySuperAdmin ? (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1.5">
                          <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Tidak Dapat Menghapus Super Admin Terakhir</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-rose-800">
                            Akun ini adalah satu-satunya Super Admin (Admin GABAH) di dalam sistem. Anda harus membuat atau menetapkan akun Super Admin lain terlebih dahulu sebelum menghapus akun ini.
                          </p>
                        </div>
                      ) : hasBlockers ? (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                          <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Pelepasan Aset Otomatis Diaktifkan</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-amber-800">
                            Pengguna ini masih terhubung dengan data operasional berikut:
                          </p>
                          <ul className="list-disc list-inside text-[11px] space-y-0.5 font-semibold text-amber-900 pl-1">
                            {assignedAssetsCount > 0 && (
                              <li>{assignedAssetsCount} aset yang dipegang akan otomatis dikembalikan ke status Tersedia (unassigned)</li>
                            )}
                            {activeLoansCount > 0 && (
                              <li>{activeLoansCount} peminjaman aktif akan ditutup secara aman</li>
                            )}
                          </ul>
                          <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                            Sistem GABAH akan otomatis melepaskan aset dan membersihkan relasi tanpa error saat Anda mengonfirmasi penghapusan.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Apakah Anda yakin ingin menghapus akun <span className="font-bold text-slate-900">{userToDelete.name}</span>? Tindakan ini akan menghapus akses login pengguna dan data akun dari database sistem.
                        </p>
                      )}

                      <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isDeletingUser}
                          onClick={() => setUserToDelete(null)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                        {!isOnlySuperAdmin && (
                          <button
                            type="button"
                            disabled={isDeletingUser}
                            onClick={handleConfirmDeleteUser}
                            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-sm shadow-rose-600/20 transition-colors flex items-center gap-1.5"
                          >
                            {isDeletingUser ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Menghapus...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{hasBlockers ? 'Lepaskan Aset & Hapus Pengguna' : 'Ya, Hapus Pengguna'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* P1#2: Reset Sandi — konfirmasi + hasil sandi sementara (tampil SEKALI) */}
              {passwordResetTarget && (
                <div className="fixed inset-0 z-[92] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">Reset Sandi Pengguna</h4>
                        <p className="text-xs text-slate-500">
                          {tempIssuedPassword
                            ? 'Sandi sementara diterbitkan oleh server — sampaikan via kanal aman (WA/telepon/pertemuan), bukan email biasa.'
                            : `Terbitkan sandi sementara baru untuk ${passwordResetTarget.name}? Sesi aktif pengguna akan dicabut.`}
                        </p>
                      </div>
                    </div>

                    {tempIssuedPassword ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 mb-1">Sandi Sementara (tampil sekali)</div>
                          <div className="font-mono text-lg font-black text-amber-900 select-all break-all">{tempIssuedPassword}</div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Server menyimpan versi hash-nya (PBKDF2). Sandi plaintext ini tidak akan ditampilkan lagi — salin sekarang sebelum menutup dialog.
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setPasswordResetTarget(null); setTempIssuedPassword(null); }}
                            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
                          >
                            Saya Sudah Menyalin
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-3">
                        <img
                          src={passwordResetTarget.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                          alt={passwordResetTarget.name}
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-800">{passwordResetTarget.name}</div>
                          <div className="text-xs text-slate-500">{passwordResetTarget.email}</div>
                        </div>
                      </div>
                    )}

                    {!tempIssuedPassword && (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPasswordResetTarget(null)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingReset}
                          onClick={handleRealPasswordReset}
                          className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {isSubmittingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>{isSubmittingReset ? 'Menerbitkan...' : 'Terbitkan Sandi Sementara'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              VIEW: 2. ROLE & PERMISSION MATRIX
             ========================================================= */}
          {activeSection === 'roles' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Role &amp; Permission Matrix</h3>
                  <p className="text-xs text-slate-500">
                    Matriks otorisasi hak akses modul dan pembatasan scope divisi untuk tata kelola BUMD
                  </p>
                </div>
                {isCurrentUserAdmin && (
                  <button
                    type="button"
                    onClick={handleResetRolePermissions}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Default Matriks</span>
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Peran (Role)</th>
                      <th className="px-3 py-3 text-center">Aset Fisik</th>
                      <th className="px-3 py-3 text-center">Peminjaman</th>
                      <th className="px-3 py-3 text-center">Tiket Helpdesk</th>
                      <th className="px-3 py-3 text-center">Lisensi &amp; SLA</th>
                      <th className="px-3 py-3 text-center">Laporan PSAK 16</th>
                      <th className="px-3 py-3 text-center">Audit Trail</th>
                      <th className="px-3 py-3 text-center">Admin Plane</th>
                      <th className="px-3 py-3 text-right">Otorisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {permissions.map((row) => (
                      <tr key={row.role} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{row.role}</div>
                          <div className="text-[11px] text-slate-400">{row.desc}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{row.assets}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">{row.loans}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">{row.tickets}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{row.licenses}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{row.reports}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">{row.audit}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.admin === 'Full Control' ? 'bg-rose-100 text-rose-800 font-black' : 'text-slate-400'
                          }`}>
                            {row.admin}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isCurrentUserAdmin ? (
                            <button
                              type="button"
                              onClick={() => {
                                setRoleToEdit(row);
                                setEditRoleRow({ ...row });
                                setIsEditRoleOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-emerald-600" />
                              <span>Ubah Otorisasi</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center gap-1">
                              <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                              <span>Terkunci</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Edit Role Permission Modal */}
              {isEditRoleOpen && editRoleRow && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <LockKeyhole className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Ubah Otorisasi Peran: {editRoleRow.role}</h4>
                          <p className="text-xs text-slate-500">Sesuaikan lingkup hak akses per modul GABAH Enterprise</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditRoleOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveRolePermissions} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Peran</label>
                        <input
                          type="text"
                          value={editRoleRow.desc}
                          onChange={e => setEditRoleRow({ ...editRoleRow, desc: e.target.value })}
                          list="role-desc-suggestions"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                        />
                        <datalist id="role-desc-suggestions">
                          {DEFAULT_PERMISSIONS.map(p => (
                            <option key={p.role} value={p.desc} />
                          ))}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {(
                          [
                            ['assets', 'Modul Aset Fisik'],
                            ['loans', 'Peminjaman & BAST'],
                            ['tickets', 'Tiket Helpdesk'],
                            ['licenses', 'Lisensi & SLA'],
                            ['reports', 'Laporan PSAK 16'],
                            ['audit', 'Audit Trail'],
                            ['admin', 'Admin Plane'],
                          ] as Array<[keyof typeof PERMISSION_TEMPLATE_FIELDS, string]>
                        ).map(([field, label]) => (
                          <div key={field}>
                            <label className="block font-bold text-slate-700 mb-1">{label}</label>
                            <select
                              value={editRoleRow[field]}
                              onChange={e => setEditRoleRow({ ...editRoleRow, [field]: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium cursor-pointer"
                            >
                              {/* Nilai tersimpan di luar template tetap ditampilkan agar tidak hilang diam-diam. */}
                              {!PERMISSION_TEMPLATE_FIELDS[field].includes(editRoleRow[field]) && (
                                <option value={editRoleRow[field]}>{editRoleRow[field]} (non-standar)</option>
                              )}
                              {PERMISSION_TEMPLATE_FIELDS[field].map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
                        <strong>Catatan tata kelola:</strong> matriks ini adalah referensi hak akses pada panel administrasi. Penegakan akses aktual (RBAC) tetap ditegakkan oleh server terhadap 9 peran resmi GABAH — perubahan di sini tidak memperluas atau membatasi hak akses riil pengguna.
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditRoleOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
                        >
                          Simpan Otorisasi
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              VIEW: 3. ORGANIZATION (DIVISI & DEPARTEMEN)
             ========================================================= */}
          {activeSection === 'organization' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Struktur Organisasi &amp; Divisi BUMD</h3>
                  <p className="text-xs text-slate-500">
                    Pemetaan kepemilikan aset (Owner Division) dan tanggung jawab departemen PT Food Station Tjipinang Jaya
                  </p>
                </div>
                {isCurrentUserAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddDivisionOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Divisi Baru</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDivisions}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset Default</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {divisions.map(div => {
                  const assetsCount = assets.filter(a => a.owner_division === div.code).length;
                  return (
                    <div key={div.code} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded-xl bg-[#4ABDAC]/15 text-[#206f65] font-black text-xs border border-[#4ABDAC]/30">
                              {div.code}
                            </span>
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-800">{div.name}</h4>
                              <div className="text-[11px] text-slate-500">{div.leader}</div>
                            </div>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                            {assetsCount} Aset Terdaftar
                          </span>
                        </div>
                        <div className="space-y-1.5 pt-3 border-t border-slate-100">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Departemen Terkait:</div>
                          {div.depts.map((d, i) => (
                            <div key={i} className="text-xs text-slate-700 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4ABDAC]" />
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Scope: {div.depts.length} Departemen Aktif
                        </span>
                        {isCurrentUserAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setDivisionToEdit({ ...div });
                                setIsEditDivisionOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-emerald-600" />
                              <span>Edit Divisi</span>
                            </button>
                            {assetsCount === 0 && divisions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDivision(div.code, div.name)}
                                title={`Hapus divisi ${div.name}`}
                                className="p-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-[11px] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 inline-flex items-center gap-1">
                            <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                            <span>Read-Only</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Division Modal */}
              {isAddDivisionOpen && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Tambah Divisi / Departemen Baru</h4>
                          <p className="text-xs text-slate-500">Daftarkan divisi baru untuk klasifikasi kepemilikan aset</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddDivisionOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleAddDivisionSubmit} className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Kode Divisi *</label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: HC, FIN"
                            value={newDivisionData.code}
                            onChange={e => setNewDivisionData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Nama Divisi *</label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: Human Capital & Korporat"
                            value={newDivisionData.name}
                            onChange={e => setNewDivisionData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pimpinan / Kepala Divisi</label>
                        <input
                          type="text"
                          placeholder="Contoh: Kepala Divisi Human Capital"
                          value={newDivisionData.leader}
                          onChange={e => setNewDivisionData(prev => ({ ...prev, leader: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Departemen / Unit Awal</label>
                        <input
                          type="text"
                          placeholder="Contoh: Personalia & Pengembangan SDM"
                          value={newDivisionData.initialDept}
                          onChange={e => setNewDivisionData(prev => ({ ...prev, initialDept: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Departemen tambahan dapat dikelola kapan saja lewat tombol Edit Divisi</p>
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsAddDivisionOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Divisi</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Division Modal */}
              {isEditDivisionOpen && divisionToEdit && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Edit Struktur Divisi {divisionToEdit.code}</h4>
                          <p className="text-xs text-slate-500">Kelola nama divisi, pimpinan, dan departemen operasional</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditDivisionOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveDivision} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Divisi</label>
                        <input
                          type="text"
                          required
                          value={divisionToEdit.name}
                          onChange={e => setDivisionToEdit({ ...divisionToEdit, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pimpinan / Penanggung Jawab</label>
                        <input
                          type="text"
                          required
                          value={divisionToEdit.leader}
                          onChange={e => setDivisionToEdit({ ...divisionToEdit, leader: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Departemen Terdaftar</label>
                        <div className="space-y-1.5 mb-2">
                          {divisionToEdit.depts.map((dept, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                              <span>{dept}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDivisionToEdit({
                                    ...divisionToEdit,
                                    depts: divisionToEdit.depts.filter((_, i) => i !== idx)
                                  });
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Nama departemen baru..."
                            value={newDeptInput}
                            onChange={e => setNewDeptInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newDeptInput.trim()) {
                                setDivisionToEdit({
                                  ...divisionToEdit,
                                  depts: [...divisionToEdit.depts, newDeptInput.trim()]
                                });
                                setNewDeptInput('');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
                          >
                            Tambah
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditDivisionOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
                        >
                          Simpan Divisi
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              VIEW: 4. MASTER DATA (KATEGORI, LOKASI, SLA)
             ========================================================= */}
          {/* ORG-MODEL: Master Jabatan/Unit/Lokasi — tiga master terpisah */}
          {activeSection === 'org_masters' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h3 className="text-sm font-black text-emerald-900">Master Organisasi: Jabatan ≠ Unit ≠ Lokasi</h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Tiga master yang <strong>terpisah</strong>: Jabatan/Level, Unit, dan Kantor/Lokasi penempatan.
                  Kombinasi role + jabatan + unit + lokasi disimpan sebagai <strong>atribut user</strong> — tidak membuat role baru.
                  Jabatan <strong>tidak</strong> otomatis memberikan permission (RBAC tetap per role), dan lokasi penempatan
                  <strong> tidak</strong> mengubah owner/asset number.
                </p>
              </div>

              {/* Master Jabatan/Level */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Master Jabatan / Level ({jobLevels.length})</h4>
                </div>
                <form onSubmit={handleAddJobLevel} className="flex flex-wrap gap-2 items-end mb-3">
                  <input type="text" placeholder="Kode (mis. MANAGER)" value={newJobLevelData.code}
                    onChange={e => setNewJobLevelData(p => ({ ...p, code: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-40 focus:outline-none focus:border-emerald-500" />
                  <input type="text" placeholder="Nama jabatan" value={newJobLevelData.label}
                    onChange={e => setNewJobLevelData(p => ({ ...p, label: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-48 focus:outline-none focus:border-emerald-500" />
                  <input type="number" placeholder="Urutan" value={newJobLevelData.order}
                    onChange={e => setNewJobLevelData(p => ({ ...p, order: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-24 focus:outline-none focus:border-emerald-500" />
                  <button type="submit" disabled={isSubmittingOrgMaster}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Tambah
                  </button>
                </form>
                <div className="space-y-1.5">
                  {[...jobLevels].sort((a, b) => (a.order || 99) - (b.order || 99)).map(jl => (
                    <div key={jl.code} className={`flex items-center justify-between p-2.5 rounded-xl border ${jl.is_active ? 'border-slate-200 bg-slate-50/70' : 'border-slate-100 bg-slate-100/60 opacity-60'} group`}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-[#4ABDAC]/15 text-[#206f65] flex items-center justify-center text-[10px] font-black">{jl.order}</span>
                        <div>
                          <div className="text-xs font-extrabold text-slate-800">{jl.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{jl.code}</div>
                        </div>
                      </div>
                      {isCurrentUserAdmin && (
                        <button type="button" onClick={() => handleToggleJobLevel(jl.code, !jl.is_active)}
                          title={jl.is_active ? 'Nonaktifkan jabatan' : 'Aktifkan jabatan'}
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold transition-colors ${jl.is_active ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                          <Power className="w-3.5 h-3.5" />
                          {jl.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Jabatan dinonaktifkan tidak bisa dipilih untuk user baru, tetapi riwayat user tetap terbaca.</p>
              </div>

              {/* Master Unit */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Master Unit / Bagian ({orgUnits.length})</h4>
                </div>
                <form onSubmit={handleAddOrgUnit} className="flex flex-wrap gap-2 items-end mb-3">
                  <input type="text" placeholder="Nama unit (mis. Logistik)" value={newOrgUnitData.name}
                    onChange={e => setNewOrgUnitData(p => ({ ...p, name: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-56 focus:outline-none focus:border-emerald-500" />
                  <select value={newOrgUnitData.division_code}
                    onChange={e => setNewOrgUnitData(p => ({ ...p, division_code: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500">
                    {['IT', 'GA', 'SC', 'PIBC', 'Audit', 'Umum'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button type="submit" disabled={isSubmittingOrgMaster}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Tambah
                  </button>
                </form>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {orgUnits.map(u => (
                    <div key={u.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${u.is_active ? 'border-slate-200 bg-slate-50/70' : 'border-slate-100 bg-slate-100/60 opacity-60'}`}>
                      <div>
                        <div className="text-xs font-extrabold text-slate-800">{u.name}</div>
                        <div className="text-[10px] text-slate-400">Divisi: {u.division_code}</div>
                      </div>
                      {isCurrentUserAdmin && (
                        <button type="button" onClick={() => handleToggleOrgUnit(u.id, !u.is_active)}
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold ${u.is_active ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                          <Power className="w-3.5 h-3.5" />
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Master Kantor/Lokasi */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Master Kantor / Lokasi Penempatan ({officeLocations.length})</h4>
                </div>
                <form onSubmit={handleAddOffice} className="flex flex-wrap gap-2 items-end mb-3">
                  <input type="text" placeholder="Nama lokasi kantor (mis. Kantor Wilayah Timur)" value={newOfficeData.name}
                    onChange={e => setNewOfficeData(p => ({ ...p, name: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-64 focus:outline-none focus:border-emerald-500" />
                  <button type="submit" disabled={isSubmittingOrgMaster}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Tambah
                  </button>
                </form>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {officeLocations.map(loc => (
                    <div key={loc.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${loc.is_active ? 'border-slate-200 bg-slate-50/70' : 'border-slate-100 bg-slate-100/60 opacity-60'}`}>
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-[#206f65]" />
                        <span className="text-xs font-extrabold text-slate-800">{loc.name}</span>
                      </div>
                      {isCurrentUserAdmin && (
                        <button type="button" onClick={() => handleToggleOffice(loc.id, !loc.is_active)}
                          className={`p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold ${loc.is_active ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                          <Power className="w-3.5 h-3.5" />
                          {loc.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Satu lokasi dapat memuat banyak unit; lokasi penempatan tidak mengubah pemilik aset maupun nomor aset.</p>
              </div>

              {/* T2B-2: Master Lokasi Fisik Aset — terpisah dari lokasi kantor
                  user; mendukung hierarki sederhana (induk → anak). */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Master Lokasi Fisik Aset ({assetLocations.length})</h4>
                </div>
                <form onSubmit={handleAddAssetLocation} className="flex flex-wrap gap-2 items-end mb-3">
                  <input type="text" placeholder="Nama lokasi fisik (mis. Gudang Utama Lt. 1)" value={newAssetLocationData.name}
                    onChange={e => setNewAssetLocationData(p => ({ ...p, name: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-64 focus:outline-none focus:border-emerald-500" />
                  <select value={newAssetLocationData.parent_id}
                    onChange={e => setNewAssetLocationData(p => ({ ...p, parent_id: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-emerald-500">
                    <option value="">— Lokasi induk (opsional) —</option>
                    {assetLocations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={isSubmittingOrgMaster}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Tambah
                  </button>
                </form>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assetLocations.map(loc => {
                    const parent = loc.parent_id ? assetLocations.find(p => p.id === loc.parent_id) : null;
                    return (
                      <div key={loc.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${loc.is_active ? 'border-slate-200 bg-slate-50/70' : 'border-slate-100 bg-slate-100/60 opacity-60'}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MapPin className="w-4 h-4 text-[#206f65] shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-slate-800">{loc.name}</span>
                            {parent && <span className="text-[10px] text-slate-400 ml-1.5">← {parent.name}</span>}
                          </div>
                        </div>
                        {isCurrentUserAdmin && (
                          <button type="button" onClick={() => handleToggleAssetLocation(loc.id, !loc.is_active)}
                            className={`p-1.5 rounded-lg flex items-center gap-1 text-[10px] font-bold ${loc.is_active ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                            <Power className="w-3.5 h-3.5" />
                            {loc.is_active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Lokasi fisik aset terpisah dari lokasi kantor penempatan user dan dari unit pengelola.
                  Lokasi nonaktif tidak dapat dipilih untuk aset baru, tetapi data historis tetap terbaca.
                  Tidak ada penghapusan permanen — gunakan nonaktif agar relasi aset tidak rusak.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'master_data' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Master Data Sistem</h3>
                  <p className="text-xs text-slate-500">Konfigurasi kategori aset, lokasi fasilitas PIBC, dan standar SLA Helpdesk</p>
                </div>
                {isCurrentUserAdmin ? (
                  <button
                    onClick={() => setIsAddCategoryOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Kategori</span>
                  </button>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed" title="Hanya Admin GABAH yang berhak menambah kategori">
                    <LockKeyhole className="w-3.5 h-3.5" />
                    <span>Tambah Kategori (Terkunci)</span>
                  </div>
                )}
              </div>

              {/* Add Category Modal */}
              {isAddCategoryOpen && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Tambah Master Kategori Aset</h4>
                          <p className="text-xs text-slate-500">Daftarkan taksonomi klasifikasi dan kode aset korporat</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddCategoryOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleAddCategorySubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Kode Aset (3-5 Huruf) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={newCategoryData.code}
                            onChange={e => setNewCategoryData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            placeholder="Contoh: PRN, HLT, FLT"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400">Digunakan pada nomor aset otomatis</span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Divisi Pemilik (Owner) <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={newCategoryData.owner_division}
                            onChange={e => {
                              const div = e.target.value;
                              setNewCategoryData(prev => ({ 
                                ...prev, 
                                owner_division: div,
                                category_type: div === 'IT' ? 'IT' : 'General'
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          >
                            <option value="IT">IT (Teknologi Informasi)</option>
                            <option value="GA">GA (General Affairs / Umum)</option>
                            <option value="SC">SC (Supply Chain &amp; Gudang)</option>
                            <option value="PIBC">PIBC (Pasar Induk Cipinang)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nama Kategori <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newCategoryData.name}
                          onChange={e => setNewCategoryData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Misal: Printer Laser & Scanner Dokumen"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Jenis Utama Aset (Main Type) *
                          </label>
                          <select
                            value={newCategoryData.main_type}
                            onChange={e => setNewCategoryData(prev => ({ ...prev, main_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            {ASSET_MAIN_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Standar PSAK 16 BUMD untuk kelompok depresiasi &amp; pelaporan akuntansi aset tetap.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Tipe Taksonomi GABAH *
                          </label>
                          <select
                            value={newCategoryData.category_type}
                            onChange={e => setNewCategoryData(prev => ({ ...prev, category_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            {GABAH_TAXONOMY_TYPES.map(g => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Modul sistem: menentukan atribut spesifikasi teknis (IT=CPU/RAM/IP/MAC, License=seat/expiry, General=fisik).
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800">Petunjuk Klasifikasi GABAH:</span>
                          <span className="text-slate-600 ml-1">
                            Pilih <b>Jenis Utama</b> sesuai akun neraca keuangan aset tetap (Peralatan, Kendaraan, Gedung), dan <b>Tipe Taksonomi</b> sesuai form spesifikasi yang dibutuhkan saat pencatatan aset baru.
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Deskripsi / Catatan Taksonomi
                        </label>
                        <textarea
                          rows={2}
                          value={newCategoryData.description}
                          onChange={e => setNewCategoryData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Keterangan singkat klasifikasi aset ini..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Dapat Dipinjam Secara Default (Loanable)</div>
                          <div className="text-[10px] text-slate-500">Aset dalam kategori ini dapat masuk formulir peminjaman sementara</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={newCategoryData.is_loanable_by_default}
                          onChange={e => setNewCategoryData(prev => ({ ...prev, is_loanable_by_default: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsAddCategoryOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingCategory}
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                        >
                          {isSubmittingCategory ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Menyimpan...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Simpan Kategori</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Category Modal */}
              {isEditCategoryOpen && categoryToEdit && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pencil className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Edit Kategori Aset ({categoryToEdit.code})</h4>
                          <p className="text-xs text-slate-500">Perbarui nama kategori, klasifikasi PSAK 16, dan taksonomi</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditCategoryOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleEditCategorySubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Kode Aset</label>
                          <input
                            type="text"
                            disabled
                            value={categoryToEdit.code}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-mono font-bold cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Divisi Pemilik (Owner) *</label>
                          <select
                            value={editCategoryData.owner_division}
                            onChange={e => setEditCategoryData(prev => ({ ...prev, owner_division: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          >
                            {divisions.map(d => (
                              <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kategori *</label>
                        <input
                          type="text"
                          required
                          value={editCategoryData.name}
                          onChange={e => setEditCategoryData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Utama Aset (Main Type)</label>
                          <select
                            value={editCategoryData.main_type}
                            onChange={e => setEditCategoryData(prev => ({ ...prev, main_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            {ASSET_MAIN_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Taksonomi GABAH</label>
                          <select
                            value={editCategoryData.category_type}
                            onChange={e => setEditCategoryData(prev => ({ ...prev, category_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            {GABAH_TAXONOMY_TYPES.map(g => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi / Catatan Taksonomi</label>
                        <textarea
                          rows={2}
                          value={editCategoryData.description}
                          onChange={e => setEditCategoryData(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800">Dapat Dipinjam Secara Default (Loanable)</div>
                          <div className="text-[10px] text-slate-500">Aset dalam kategori ini dapat masuk formulir peminjaman sementara</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={editCategoryData.is_loanable_by_default}
                          onChange={e => setEditCategoryData(prev => ({ ...prev, is_loanable_by_default: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditCategoryOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Perubahan</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Master Kategori List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Kategori Aset Terdaftar ({categories.length})
                  </h4>
                  {!isCurrentUserAdmin && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                      <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                      <span>Hanya-Baca</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map(cat => (
                    <div key={cat.code} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between group">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#206f65]">{cat.code}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold">
                            {cat.type}
                          </span>
                          {cat.is_active === false && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 font-bold">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-800 mt-1">{cat.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {cat.loanable ? 'Dapat Dipinjam (Loanable)' : 'Inventaris Tetap'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">
                          {cat.total} Unit
                        </span>
                        {isCurrentUserAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryActive(cat.code, cat.name, cat.is_active === false)}
                              title={cat.is_active === false ? `Aktifkan kategori ${cat.name}` : `Nonaktifkan kategori ${cat.name} (tetap terbaca untuk aset historis)`}
                              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryToEdit(cat);
                                setEditCategoryData({
                                  code: cat.code,
                                  name: cat.name,
                                  main_type: cat.main_type || 'LNY',
                                  owner_division: cat.type || 'IT',
                                  category_type: cat.category_type || (cat.type === 'IT' ? 'IT' : 'General'),
                                  description: cat.description || '',
                                  is_loanable_by_default: cat.loanable ?? false,
                                });
                                setIsEditCategoryOpen(true);
                              }}
                              title={`Edit kategori ${cat.name}`}
                              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {cat.total === 0 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.code, cat.name)}
                                title={`Hapus kategori ${cat.name}`}
                                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Master Lokasi */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Master Lokasi &amp; Fasilitas Gudang PIBC ({locations.length})
                  </h4>
                  {isCurrentUserAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsAddLocationOpen(true)}
                      className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Lokasi</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                      <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                      <span>Hanya-Baca</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map((loc, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#4ABDAC]/15 text-[#206f65] flex items-center justify-center shrink-0 mt-0.5">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-800">{loc.name}</div>
                          <div className="text-[11px] text-slate-500">{loc.address}</div>
                          <span className="inline-block mt-1 text-[10px] font-bold text-[#206f65] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Kapasitas: {loc.capacity}
                          </span>
                        </div>
                      </div>
                      {isCurrentUserAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setLocationToEdit(loc);
                              setEditLocationData({
                                id: loc.id,
                                name: loc.name,
                                address: loc.address,
                                capacity: loc.capacity,
                              });
                              setIsEditLocationOpen(true);
                            }}
                            title={`Edit lokasi ${loc.name}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {locations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLocation(loc.id, loc.name)}
                              title={`Hapus lokasi ${loc.name}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Location Modal */}
              {isAddLocationOpen && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Tambah Lokasi Fasilitas Baru</h4>
                          <p className="text-xs text-slate-500">Daftarkan gudang, gedung kantor, atau fasilitas logistik PIBC</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddLocationOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleAddLocationSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lokasi / Fasilitas *</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Gedung Penggilingan Beras Cipinang"
                          value={newLocationData.name}
                          onChange={e => setNewLocationData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Alamat / Area Lokasi</label>
                        <input
                          type="text"
                          placeholder="Contoh: Blok G No. 12-14, Kawasan PIBC, Jakarta Timur"
                          value={newLocationData.address}
                          onChange={e => setNewLocationData(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Kapasitas / Peruntukan Fasilitas</label>
                        <input
                          type="text"
                          placeholder="Contoh: 15.000 Ton Beras / Kantor 30 Staf"
                          value={newLocationData.capacity}
                          onChange={e => setNewLocationData(prev => ({ ...prev, capacity: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsAddLocationOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Lokasi</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Location Modal */}
              {isEditLocationOpen && locationToEdit && (
                <div className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Pencil className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">Edit Lokasi Fasilitas</h4>
                          <p className="text-xs text-slate-500">Perbarui data lokasi dan peruntukan fasilitas gudang</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditLocationOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleEditLocationSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lokasi / Fasilitas *</label>
                        <input
                          type="text"
                          required
                          value={editLocationData.name}
                          onChange={e => setEditLocationData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Alamat / Area Lokasi</label>
                        <input
                          type="text"
                          value={editLocationData.address}
                          onChange={e => setEditLocationData(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Kapasitas / Peruntukan Fasilitas</label>
                        <input
                          type="text"
                          value={editLocationData.capacity}
                          onChange={e => setEditLocationData(prev => ({ ...prev, capacity: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditLocationOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Perubahan</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              VIEW: 5. ASSET NUMBERING (SEQUENCE ENGINE)
             ========================================================= */}
          {activeSection === 'numbering' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900">Asset Numbering & Sequence Engine</h3>
                <p className="text-xs text-slate-500">
                  Format otoritatif: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#206f65] font-bold">{'{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}'}</code>
                </p>
              </div>

              {/* Simulator Card */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-200">
                <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-3">
                  Live Sequence Generator & Simulator
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Divisi Pemilik (Owner)</label>
                    <select
                      value={testDiv}
                      onChange={e => {
                        const d = e.target.value as OwnerDivision;
                        setTestDiv(d);
                        setSimulatedNumber(`${d}-${testCode}-2026-000${Math.floor(Math.random() * 5) + 1}`);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                    >
                      <option value="IT">IT (Teknologi Informasi)</option>
                      <option value="SC">SC (Supply Chain Beras)</option>
                      <option value="GA">GA (General Affairs)</option>
                      <option value="PIBC">PIBC (Pasar Induk)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Aset (Asset Code)</label>
                    <input
                      type="text"
                      value={testCode}
                      onChange={e => {
                        const c = e.target.value.toUpperCase();
                        setTestCode(c);
                        setSimulatedNumber(`${testDiv}-${c}-2026-0001`);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold uppercase"
                      placeholder="Contoh: HLT, FLT, BLD"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hasil Nomor Otomatis</label>
                    <div className="px-3 py-2 rounded-xl border border-emerald-300 bg-white text-xs font-mono font-black text-emerald-800 flex items-center justify-between">
                      <span>{simulatedNumber}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-emerald-800 leading-relaxed">
                  ✓ Sequence direset otomatis setiap awal tahun per kombinasi (Divisi, Kode Aset, Tahun).
                  <br />
                  ✓ Thread-safe & concurrency-safe dengan pemulihan sequence otomatis dari database.
                </div>
              </div>

              {/* Status Sequence Terkini — live dari server (P2#10) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                  Sequence Counter Terdaftar (Live dari Server)
                </h4>
                {liveSequences === null ? (
                  <div className="text-xs text-slate-400 py-3 text-center">Memuat snapshot sequence dari server…</div>
                ) : liveSequences.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    Belum ada sequence terdaftar — counter terisi otomatis saat aset pertama didaftarkan per kombinasi (Divisi, Kode, Tahun).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {liveSequences.slice(0, 12).map(seq => (
                      <div key={seq.key} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="text-[10px] font-mono text-slate-500 font-bold">{seq.key}</div>
                        <div className="text-xs font-extrabold text-slate-800 mt-0.5">Divisi {seq.division} · {seq.code}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Terakhir: <b>{seq.current}</b></span>
                          <span className="font-mono font-bold text-[#206f65] bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            Next: {seq.division}-{seq.code}-{seq.year}-{String(seq.current + 1).padStart(4, '0')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {liveSequences !== null && liveSequences.length > 12 && (
                  <div className="mt-2 text-[10px] text-slate-400">Menampilkan 12 dari {liveSequences.length} kombinasi sequence terdaftar.</div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 6. NOTIFICATION CENTER
             ========================================================= */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Notification Center &amp; Alert Rules</h3>
                  <p className="text-xs text-slate-500">
                    Aturan otomasi peringatan sistem, masa tenggat peminjaman, batas SLA tiket, dan masa garansi
                  </p>
                </div>
                {!isCurrentUserAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                    <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                    <span>Konfigurasi Terkunci (Mode Audit)</span>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {notificationRules.map((rule, idx) => (
                  <div key={rule.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-slate-800">{rule.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rule.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {rule.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Pemicu: <span className="font-semibold text-slate-700">{rule.trigger}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Penerima: {rule.target}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCurrentUserAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleToggleNotificationRule(rule.id)}
                          title="Aktifkan/nonaktifkan aturan — tersimpan di panel administrasi ini"
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                            rule.status === 'Aktif'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${rule.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span>{rule.status === 'Aktif' ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                          <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                          <span>Read-Only</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-[11px] text-teal-900 leading-relaxed">
                <strong className="font-extrabold">Reminder Kontrak (otomatis):</strong> engine CR-05 mengirim reminder kedaluwarsa kontrak (60/35/7 hari + notice date) via in-app, email, dan Telegram secara terjadwal — idempoten per hari. Penerima di-resolve server-side (PIC, divisi pemilik, eskalasi) — bukan broadcast.
              </div>

              {/* P2#11: CR-05 reminder subsystem overview — live dari server */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Reminder Kontrak CR-05 — Status Live Subsistem
                  </h4>
                  <button
                    type="button"
                    onClick={refreshReminderOverview}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" />
                    <span>Muat Ulang</span>
                  </button>
                </div>

                {reminderOverviewError ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                    Overview reminder tidak tersedia: {reminderOverviewError} (endpoint ini khusus Admin GABAH).
                  </div>
                ) : !reminderOverview ? (
                  <div className="text-xs text-slate-400 py-3 text-center">Memuat status subsistem reminder dari server…</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Scheduler</div>
                        <div className={`text-sm font-black mt-0.5 ${reminderOverview.scheduler?.enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {reminderOverview.scheduler?.enabled ? 'Aktif' : 'Nonaktif'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Interval {Math.round((reminderOverview.scheduler?.intervalMs || 0) / 60000)} menit · {reminderOverview.timezone}
                          <br />Run terakhir: {reminderOverview.scheduler?.lastRun || '—'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Provider Eksternal</div>
                        <div className="text-sm font-black mt-0.5 text-slate-800">
                          Email: {reminderOverview.providers?.email_configured ? 'Terkonfigurasi' : 'Belum'}
                          {' · '}
                          Telegram: {reminderOverview.providers?.telegram_configured ? 'Terkonfigurasi' : 'Belum'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Provider belum dikonfigurasi → pengiriman berstatus skipped (jujur, bukan gagal).
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Threshold (hari)</div>
                        <div className="text-sm font-black mt-0.5 text-slate-800">
                          {reminderOverview.thresholds?.reminder1_days ?? 60} / {reminderOverview.thresholds?.reminder2_days ?? 35} / {reminderOverview.thresholds?.reminder3_days ?? 7}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {reminderOverview.contracts_monitored} kontrak aktif terpantau
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Statistik Pengiriman</div>
                        <div className="text-sm font-black mt-0.5">
                          <span className="text-emerald-700">{reminderOverview.delivery?.by_status?.sent ?? 0} sent</span>
                          {' · '}
                          <span className="text-amber-700">{reminderOverview.delivery?.by_status?.skipped ?? 0} skipped</span>
                          {' · '}
                          <span className="text-rose-700">{reminderOverview.delivery?.by_status?.failed ?? 0} failed</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Total {reminderOverview.delivery?.total_logs ?? 0} log pengiriman
                        </div>
                      </div>
                    </div>

                    {(reminderOverview.recent_failures || []).length > 0 && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 mb-1">Kegagalan Terakhir (maks 5)</div>
                        {reminderOverview.recent_failures.map((f: any) => (
                          <div key={f.id} className="text-[11px] text-rose-900 font-mono truncate">
                            {f.scheduled_at?.slice(0, 16).replace('T', ' ')} · {f.channel} · {f.notification_type} · {f.recipient} — {f.error_message || 'unknown error'}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 7. AUDIT LOG VIEWER (WORM IMMUTABLE COMPLIANCE)
             ========================================================= */}
          {activeSection === 'audit_log' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">Audit Trail &amp; Activity Log</h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      WORM IMMUTABLE (KEPATUHAN BPK / INSPEKTORAT)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Rekam jejak kepatuhan dan audit forensik seluruh operasi sistem — tidak dapat diedit/dihapus siapapun</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari pengguna/aksi/rincian..."
                      value={auditSearch}
                      onChange={e => { setAuditSearch(e.target.value); setAuditPage(0); }}
                      className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#4ABDAC] w-52"
                    />
                  </div>
                  <select
                    value={auditActionFilter}
                    onChange={e => { setAuditActionFilter(e.target.value); setAuditPage(0); }}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#4ABDAC]"
                  >
                    <option value="ALL">Semua Aksi</option>
                    {[...new Set(auditLogs.map(l => l.action))].sort().map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                  <button
                    onClick={exportAuditLogsCsv}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    onClick={() => exportDataJson('gabah_audit_logs', auditLogs)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor JSON</span>
                  </button>
                </div>
              </div>

              {/* Immutable Policy Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-extrabold">Integritas Audit Forensik Terjamin:</span> Seluruh mutasi data, penambahan aset, penerbitan BAST, dan eskalasi SLA dicatat secara permanen. Fitur edit dan hapus log ditiadakan untuk memenuhi standar akuntabilitas audit BUMD DKI Jakarta.
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Waktu &amp; Tanggal</th>
                      <th className="px-4 py-3">Pengguna &amp; Peran</th>
                      <th className="px-4 py-3">Aksi</th>
                      <th className="px-4 py-3">Entitas</th>
                      <th className="px-4 py-3">Rincian Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const q = auditSearch.trim().toLowerCase();
                      const filtered = auditLogs.filter(l => {
                        const matchAction = auditActionFilter === 'ALL' || l.action === auditActionFilter;
                        const matchSearch = !q
                          || (l.user_name || '').toLowerCase().includes(q)
                          || (l.action || '').toLowerCase().includes(q)
                          || (l.entity || '').toLowerCase().includes(q)
                          || (l.details || '').toLowerCase().includes(q);
                        return matchAction && matchSearch;
                      });
                      const pageCount = Math.max(1, Math.ceil(filtered.length / AUDIT_PAGE_SIZE));
                      const page = Math.min(auditPage, pageCount - 1);
                      const rows = filtered.slice(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE);

                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">Tidak ada log yang cocok dengan filter.</td>
                          </tr>
                        );
                      }

                      return (
                        <>
                          {rows.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 font-medium">
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {log.timestamp}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-bold text-slate-800">{log.user_name}</div>
                                <div className="text-[10px] text-slate-400">{log.user_role}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                  log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-700' :
                                  log.action.includes('UPDATE') ? 'bg-blue-50 text-blue-700' :
                                  log.action.includes('DELETE') ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                                {log.entity} {log.entity_id ? `(${log.entity_id})` : ''}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600 max-w-md truncate">
                                {log.details}
                              </td>
                            </tr>
                          ))}
                          {filtered.length > AUDIT_PAGE_SIZE && (
                            <tr>
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>Menampilkan {page * AUDIT_PAGE_SIZE + 1}–{Math.min((page + 1) * AUDIT_PAGE_SIZE, filtered.length)} dari {filtered.length} log (total {auditLogs.length})</span>
                                  <div className="flex items-center gap-1.5">
                                    <button type="button" disabled={page === 0} onClick={() => setAuditPage(page - 1)} className="px-2.5 py-1 rounded-lg border border-slate-200 font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer">← Sebelumnya</button>
                                    <span className="px-2 font-bold">Hal. {page + 1}/{pageCount}</span>
                                    <button type="button" disabled={page >= pageCount - 1} onClick={() => setAuditPage(page + 1)} className="px-2.5 py-1 rounded-lg border border-slate-200 font-bold disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Berikutnya →</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 8. SYSTEM SETTINGS
             ========================================================= */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">System Parameters &amp; BUMD Policies</h3>
                    <p className="text-xs text-slate-500">Konfigurasi entitas organisasi, standar pelaporan PSAK 16, dan SLA</p>
                  </div>
                  {!isCurrentUserAdmin && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                      <LockKeyhole className="w-2.5 h-2.5 text-slate-400" />
                      <span>Parameter Terkunci (Read-Only)</span>
                    </span>
                  )}
                </div>
              </div>

              {!isCurrentUserAdmin && (
                <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center gap-3">
                  <LockKeyhole className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <span className="font-extrabold">Mode Akses Pemeriksaan (Auditor):</span> Parameter entitas dan SLA helpdesk hanya dapat dimodifikasi oleh <b>Admin GABAH</b>. Form berikut disajikan dalam format hanya-baca.
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Nama BUMD / Instansi</label>
                      <input
                        type="text"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.companyName}
                        onChange={e => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Standar Akuntansi Aset Tetap</label>
                      <input
                        type="text"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.accountingStandard}
                        onChange={e => setSettingsForm({ ...settingsForm, accountingStandard: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Mata Uang Basis</label>
                      <input
                        type="text"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.baseCurrency}
                        onChange={e => setSettingsForm({ ...settingsForm, baseCurrency: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-semibold">Tahun Buku Fiskal</label>
                      <input
                        type="text"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.fiscalYear}
                        onChange={e => setSettingsForm({ ...settingsForm, fiscalYear: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed font-mono font-medium"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-[11px] text-sky-900 leading-relaxed">
                    <strong>Catatan:</strong> parameter entitas (nama, standar, mata uang, tahun buku) tersimpan sebagai konfigurasi tampilan panel administrasi ini. Batas SLA helpdesk di bawah merupakan <strong>referensi</strong> — nilai SLA operasional riil saat ini ditetapkan server (Urgent 4h, High 8h, Medium 24h, Low 48h) dan belum dapat diubah dari UI.
                  </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                    Batas Waktu Resolusi SLA Helpdesk (Jam)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-red-600 mb-1 font-bold">Urgent (Kritis)</label>
                      <input
                        type="number"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.slaUrgentHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaUrgentHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-red-200 bg-red-50/30 font-bold text-red-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-600 mb-1 font-bold">High (Tinggi)</label>
                      <input
                        type="number"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.slaHighHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaHighHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/30 font-bold text-amber-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-600 mb-1 font-bold">Medium (Sedang)</label>
                      <input
                        type="number"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.slaMediumHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaMediumHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 font-bold text-blue-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">Low (Rendah)</label>
                      <input
                        type="number"
                        disabled={!isCurrentUserAdmin}
                        value={settingsForm.slaLowHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaLowHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  {isCurrentUserAdmin ? (
                    <button
                      onClick={handleSaveSettings}
                      className="px-5 py-2 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold shadow-md shadow-[#4ABDAC]/20 hover:bg-[#3ba393] cursor-pointer"
                    >
                      Simpan Pengaturan Sistem
                    </button>
                  ) : (
                    <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed">
                      <LockKeyhole className="w-3.5 h-3.5" />
                      <span>Simpan Terkunci (Read-Only)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 9. DATA ADMINISTRATION & ENTERPRISE BACKUP
             ========================================================= */}
          {activeSection === 'data_admin' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Data Administration &amp; Reconciliation</h3>
                  <p className="text-xs text-slate-500">Ekspor data komprehensif, backup database, dan rekonsiliasi SAP</p>
                </div>
                {isCurrentUserAdmin && (
                  <button
                    onClick={handleFullSystemBackup}
                    className="px-3.5 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold hover:bg-[#3ba393] shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Download Full Backup System</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800">Ekspor Seluruh Data Aset</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Unduh daftar {assets.length} unit aset beserta nilai buku, depresiasi PSAK 16, dan riwayat mutasi.
                    </p>
                  </div>
                  <button
                    onClick={() => exportDataJson('gabah_assets_master', assets)}
                    className="mt-4 w-full py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Aset</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800">Ekspor Peminjaman &amp; BAST</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Unduh riwayat reservasi, status serah terima fisik, dan log pengembalian aset Food Station.
                    </p>
                  </div>
                  <button
                    onClick={() => exportDataJson('gabah_loans_bast', loans)}
                    className="mt-4 w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Peminjaman</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-800">Audit Rekonsiliasi SAP</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Cocokkan kode aset fisik ASTICK dengan catatan akuntansi buku besar SAP BUMD.
                    </p>
                  </div>
                  <button
                    onClick={handleSapReconciliation}
                    className="mt-4 w-full py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Jalankan Rekonsiliasi</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 10. SYSTEM HEALTH
             ========================================================= */}
          {activeSection === 'health' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">System Health & Service Diagnostics</h3>
                  <p className="text-xs text-slate-500">Status operasional API, memori, engine penomoran, dan konektivitas</p>
                </div>
                <button
                  onClick={pingHealthCheck}
                  disabled={healthStatus.isChecking}
                  className="px-3 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold hover:bg-[#3ba393] flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${healthStatus.isChecking ? 'animate-spin' : ''}`} />
                  <span>Ping Server Sekarang</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>API Express Server</span>
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className={`text-lg font-black ${healthStatus.latency === null ? 'text-slate-400' : 'text-slate-900'}`}>{healthStatus.status}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Latency: <b className={healthStatus.latency !== null ? 'text-emerald-600' : 'text-slate-400'}>{healthStatus.latency !== null ? `${healthStatus.latency} ms` : 'belum diukur'}</b> · Diperiksa: {healthStatus.timestamp || '—'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Persistence (CR-04)</span>
                    <Database className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className={`text-lg font-black ${
                    healthStatus.persistence === 'postgresql' ? 'text-emerald-700'
                    : healthStatus.persistence?.includes('file-store') ? 'text-amber-700'
                    : 'text-slate-400'
                  }`}>
                    {healthStatus.persistence === 'postgresql'
                      ? 'PostgreSQL Aktif'
                      : healthStatus.persistence?.includes('file-store')
                      ? 'File Store (Dev Fallback)'
                      : 'Belum Diperiksa'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {healthStatus.persistence === 'postgresql'
                      ? 'Migrasi 001–005 tersinkron (ledger)'
                      : healthStatus.persistence?.includes('file-store')
                      ? 'Production akan fail-fast tanpa DATABASE_URL'
                      : 'Klik "Ping Server Sekarang" untuk memuat status riil'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Reminder Scheduler (CR-05)</span>
                    <Bell className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className={`text-lg font-black ${
                    healthStatus.scheduler?.enabled === false ? 'text-slate-500'
                    : healthStatus.scheduler ? 'text-emerald-700'
                    : 'text-slate-400'
                  }`}>
                    {healthStatus.scheduler
                      ? (healthStatus.scheduler.enabled ? 'Berjalan' : 'Dinonaktifkan')
                      : 'Belum Diperiksa'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {healthStatus.scheduler
                      ? `Interval ${(healthStatus.scheduler.intervalMs ?? 0) / 60000 || '?'} menit · ${healthStatus.scheduler.timezone || '-'} · Run terakhir: ${healthStatus.scheduler.lastRun || '—'}${healthStatus.scheduler.lastRun ? '' : ' (menunggu jadwal pertama)'}`
                      : 'Status dari /api/health'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Data Records Active</span>
                    <Cpu className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900">{assets.length + loans.length + tickets.length} Records</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {assets.length} Aset · {loans.length} Pinjam · {tickets.length} Tiket
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 mb-1">Diagnostic Log Snapshot (dari respons /api/health):</div>
                <div>[GABAH Health] persistence: {healthStatus.persistence || 'belum diperiksa'}</div>
                <div>[GABAH Scheduler] enabled: {healthStatus.scheduler?.enabled ?? 'belum diperiksa'} · timezone: {healthStatus.scheduler?.timezone || '-'} · intervalMs: {healthStatus.scheduler?.intervalMs ?? '-'}</div>
                <div>[GABAH Data] {assets.length} aset · {loans.length} peminjaman · {tickets.length} tiket · {userList.length} pengguna · {auditLogs.length} log audit</div>
                <div>[GABAH RBAC] 9 peran resmi ditegakkan server-side (Admin GABAH, IT, GA, Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan, Auditor)</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
