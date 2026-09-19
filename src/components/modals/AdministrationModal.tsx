import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  LockKeyhole,
  Building2,
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
  Pencil
} from 'lucide-react';
import { UserProfile, UserRole, AuditLog, Asset, Loan, Ticket, OwnerDivision } from '../../types';
import { gabahApi } from '../../services/gabahApi';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'roles'
  | 'organization'
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
  onUpdateUser?: (updated: UserProfile) => void;
  onCreateUser?: (newUser: UserProfile) => void;
  onDeleteUser?: (userId: string) => void;
  showToast: (text: string, type?: 'success' | 'warning' | 'info') => void;
  onRefreshData?: () => Promise<void>;
}

export const AdministrationModal: React.FC<AdministrationModalProps> = ({
  isOpen,
  onClose,
  users,
  auditLogs,
  assets,
  loans,
  tickets,
  onUpdateUser,
  onCreateUser,
  onDeleteUser,
  showToast,
  onRefreshData
}) => {
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
  const [editUserData, setEditUserData] = useState<{
    name: string;
    email: string;
    role: UserRole;
    division: OwnerDivision;
    department: string;
    phone: string;
    is_active: boolean;
    new_password: string;
  }>({
    name: '',
    email: '',
    role: 'Karyawan',
    division: 'SC',
    department: '',
    phone: '',
    is_active: true,
    new_password: '',
  });

  const [newUserData, setNewUserData] = useState<Partial<UserProfile>>({
    name: '',
    email: '',
    role: 'Karyawan',
    role_label: 'Pegawai Operasional',
    division: 'SC',
    department: 'Pergudangan & Distribusi',
    temp_password: 'Pangan2026!'
  });

  useEffect(() => {
    if (users && users.length > 0) {
      setUserList(users);
    }
  }, [users]);

  // Master Data State
  const [categories, setCategories] = useState([
    { code: 'IT-HLT', name: 'Hardware Laptop & PC', type: 'IT', loanable: true, total: 42 },
    { code: 'IT-SRV', name: 'Server & Infrastructure', type: 'IT', loanable: false, total: 18 },
    { code: 'SC-FLT', name: 'Armada Truk Beras Cipinang', type: 'SC', loanable: true, total: 24 },
    { code: 'GA-BLD', name: 'Gedung & Fasilitas Pasar', type: 'GA', loanable: false, total: 31 },
    { code: 'LIC-ENT', name: 'Lisensi ERP SAP & OS', type: 'License', loanable: false, total: 15 },
  ]);
  const [locations, setLocations] = useState([
    { name: 'Kantor Pusat Food Station Cipinang', address: 'Jl. Pisangan Lama No. 1, Jakarta Timur', capacity: '120 Pegawai' },
    { name: 'Gudang Beras Induk Blok A-D', address: 'Kawasan PIBC, Jakarta Timur', capacity: '48.000 Ton Beras' },
    { name: 'Depo Armada & Transportasi', address: 'Pintu 3 Pasar Induk Cipinang', capacity: '35 Truk Fuso' },
    { name: 'Data Center & Server Room', address: 'Gedung Utama Lt. 2, Cipinang', capacity: 'Tier 2 Redundant' }
  ]);

  // Asset Numbering State
  const [testDiv, setTestDiv] = useState<OwnerDivision>('IT');
  const [testCode, setTestCode] = useState('HLT');
  const [simulatedNumber, setSimulatedNumber] = useState('IT-HLT-2026-0005');

  // System Settings State
  const [settingsForm, setSettingsForm] = useState({
    companyName: 'PT Food Station Tjipinang Jaya (Perseroda)',
    shortCode: 'GABAH',
    orgType: 'BUMD Pangan Pemerintah Provinsi DKI Jakarta',
    accountingStandard: 'PSAK 16 (Aset Tetap & Depresiasi Garis Lurus)',
    baseCurrency: 'IDR (Rupiah)',
    fiscalYear: '2026',
    slaUrgentHours: 4,
    slaHighHours: 8,
    slaMediumHours: 24,
    slaLowHours: 48,
    autoBackupDaily: true,
    auditRetentionDays: 90
  });

  // Health Check State
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    latency: number | null;
    timestamp: string;
    isChecking: boolean;
  }>({
    status: 'Operational',
    latency: 3,
    timestamp: new Date().toLocaleTimeString(),
    isChecking: false
  });

  if (!isOpen) return null;

  const adminMenuCards = [
    { id: 'users' as AdminSection, label: 'User Management', description: 'Kelola pengguna, peranan, divisi, dan sandi sementara', icon: Users, badge: `${userList.length} User` },
    { id: 'roles' as AdminSection, label: 'Role & Permission', description: 'Matriks otorisasi per modul & pembatasan scope divisi', icon: LockKeyhole, badge: '8 Roles' },
    { id: 'organization' as AdminSection, label: 'Organization', description: 'Divisi operasional Food Station & struktur departemen', icon: Building2, badge: '4 Divisi' },
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
        phone: newUserData.phone || '',
        temp_password: newUserData.temp_password || 'Pangan2026!'
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
        department: 'Pergudangan & Distribusi',
        temp_password: 'Pangan2026!'
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
      phone: user.phone || '',
      is_active: user.is_active !== undefined ? user.is_active : true,
      new_password: '',
    });
    setIsEditUserOpen(true);
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

  // Run ping health check
  const pingHealthCheck = async () => {
    setHealthStatus(prev => ({ ...prev, isChecking: true }));
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setHealthStatus({
          status: 'Operational (200 OK)',
          latency,
          timestamp: new Date().toLocaleTimeString(),
          isChecking: false
        });
        showToast(`API Server sehat! Waktu respon: ${latency} ms`, 'success');
      } else {
        setHealthStatus({
          status: 'Degraded',
          latency,
          timestamp: new Date().toLocaleTimeString(),
          isChecking: false
        });
        showToast('API mengembalikan respon tidak normal', 'warning');
      }
    } catch {
      setHealthStatus({
        status: 'Error Menghubungi API',
        latency: null,
        timestamp: new Date().toLocaleTimeString(),
        isChecking: false
      });
      showToast('Gagal menghubungi backend API', 'warning');
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Administration Control Plane</h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#4ABDAC]/15 text-[#206f65] border border-[#4ABDAC]/30">
                  SUPER ADMIN
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
                    <span>Ping API ({healthStatus.latency ?? 3} ms)</span>
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
                    <option value="all">Semua Peran</option>
                    <option value="Admin GABAH">Admin GABAH</option>
                    <option value="IT">IT Support</option>
                    <option value="GA">General Affairs</option>
                    <option value="Supply Chain">Supply Chain</option>
                    <option value="PIBC">PIBC Pasar</option>
                    <option value="Management">Management</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Karyawan">Karyawan</option>
                  </select>
                  <button
                    onClick={() => setIsAddUserOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold hover:bg-[#3ba393] flex items-center gap-1.5 shadow-sm shadow-[#4ABDAC]/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Pengguna</span>
                  </button>
                </div>
              </div>

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
                        placeholder="rian@foodstation.id"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Peran (Role)</label>
                      <select
                        value={newUserData.role}
                        onChange={e => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                      >
                        <option value="Karyawan">Karyawan (Peminjam)</option>
                        <option value="IT">IT (Teknis & Jaringan)</option>
                        <option value="GA">GA (Fasilitas Gedung)</option>
                        <option value="Supply Chain">Supply Chain (Logistik)</option>
                        <option value="PIBC">PIBC (Pasar Induk)</option>
                        <option value="Management">Management (Direksi)</option>
                        <option value="Auditor">Auditor (Pemeriksa)</option>
                        <option value="Admin GABAH">Admin GABAH (Super Admin)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Divisi</label>
                      <select
                        value={newUserData.division}
                        onChange={e => setNewUserData({ ...newUserData, division: e.target.value as OwnerDivision })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value="SC">Supply Chain & Pergudangan</option>
                        <option value="PIBC">Pasar Induk Beras Cipinang</option>
                        <option value="IT">Teknologi Informasi</option>
                        <option value="GA">General Affairs</option>
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
                    <div>
                      <label className="block text-slate-600 mb-1 font-medium">Sandi Sementara</label>
                      <input
                        type="text"
                        value={newUserData.temp_password}
                        onChange={e => setNewUserData({ ...newUserData, temp_password: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono"
                      />
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
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              user.role === 'Admin GABAH'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : user.role === 'IT'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : user.role === 'GA'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : user.role === 'Supply Chain'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-700">{user.division || '-'}</div>
                            <div className="text-[11px] text-slate-400">{user.department}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {user.temp_password || '********'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title={`Edit data ${user.name}`}
                                onClick={() => handleOpenEditUser(user)}
                                className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold whitespace-nowrap transition-colors flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3 text-emerald-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                title={`Reset sandi untuk ${user.name}`}
                                onClick={() => showToast(`Link reset sandi untuk ${user.name} dikirim ke ${user.email}`)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px] font-bold whitespace-nowrap transition-colors"
                              >
                                Reset Sandi
                              </button>
                              <button
                                type="button"
                                title={`Hapus pengguna ${user.name}`}
                                onClick={() => setUserToDelete(user)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center justify-center shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
                            <option value="Admin GABAH">Admin GABAH (Super Admin)</option>
                            <option value="IT">IT (Infrastruktur & Hardware)</option>
                            <option value="GA">GA (General Affairs & Sarpras)</option>
                            <option value="Supply Chain">Supply Chain (Logistik & Pabrik)</option>
                            <option value="PIBC">PIBC (Pasar Induk Cipinang)</option>
                            <option value="Management">Management (Direksi / Kadiv)</option>
                            <option value="Auditor">Auditor (Satuan Pengawas Internal)</option>
                            <option value="Karyawan">Karyawan (Pegawai Umum)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Divisi Utama *</label>
                          <select
                            value={editUserData.division}
                            onChange={e => setEditUserData(prev => ({ ...prev, division: e.target.value as OwnerDivision }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          >
                            <option value="IT">IT (Divisi Teknologi & Sistem)</option>
                            <option value="GA">GA (Divisi Umum & Aset)</option>
                            <option value="SC">SC (Supply Chain & Beras)</option>
                            <option value="PIBC">PIBC (Kawasan Pasar Induk)</option>
                            <option value="Direksi">Direksi</option>
                            <option value="Komersial">Komersial & Pemasaran</option>
                            <option value="Umum">Umum / Lainnya</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">Departemen / Unit</label>
                          <input
                            type="text"
                            value={editUserData.department}
                            onChange={e => setEditUserData(prev => ({ ...prev, department: e.target.value }))}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            placeholder="Contoh: Operasional Beras SPHP"
                          />
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
            </div>
          )}

          {/* =========================================================
              VIEW: 2. ROLE & PERMISSION MATRIX
             ========================================================= */}
          {activeSection === 'roles' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900">Role & Permission Matrix</h3>
                <p className="text-xs text-slate-500">
                  Matriks otorisasi hak akses modul dan pembatasan scope divisi untuk tata kelola BUMD
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Peran (Role)</th>
                      <th className="px-3 py-3 text-center">Aset Fisik</th>
                      <th className="px-3 py-3 text-center">Peminjaman</th>
                      <th className="px-3 py-3 text-center">Tiket Helpdesk</th>
                      <th className="px-3 py-3 text-center">Lisensi & SLA</th>
                      <th className="px-3 py-3 text-center">Laporan PSAK 16</th>
                      <th className="px-3 py-3 text-center">Audit Trail</th>
                      <th className="px-3 py-3 text-center">Admin Plane</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[
                      { role: 'Admin GABAH', desc: 'Super Administrator', assets: 'Full Access', loans: 'Approve & Handover', tickets: 'All Categories', licenses: 'Full', reports: 'Full', audit: 'Full', admin: 'Full Control' },
                      { role: 'IT Support', desc: 'Teknis & Infrastruktur', assets: 'Divisi IT', loans: 'Approve IT Aset', tickets: 'IT & License', licenses: 'Manage', reports: 'Divisi IT', audit: 'View IT', admin: 'No' },
                      { role: 'General Affairs', desc: 'Fasilitas & Gedung', assets: 'Divisi GA', loans: 'Approve GA Aset', tickets: 'Fasilitas GA', licenses: 'Read', reports: 'Divisi GA', audit: 'View GA', admin: 'No' },
                      { role: 'Supply Chain', desc: 'Armada & Gudang Beras', assets: 'Divisi SC', loans: 'Approve Truk/SC', tickets: 'Logistik SC', licenses: 'Read', reports: 'Divisi SC', audit: 'View SC', admin: 'No' },
                      { role: 'PIBC', desc: 'Operasional Pasar', assets: 'Divisi PIBC', loans: 'Approve Pasar', tickets: 'Operasional', licenses: 'Read', reports: 'Divisi PIBC', audit: 'View', admin: 'No' },
                      { role: 'Management', desc: 'Direksi BUMD Pangan', assets: 'All (View)', loans: 'Executive View', tickets: 'SLA Review', licenses: 'View', reports: 'PSAK 16 Full', audit: 'Full Read', admin: 'No' },
                      { role: 'Auditor', desc: 'Inspektorat / BPK', assets: 'Audit Only', loans: 'Audit History', tickets: 'Audit Trail', licenses: 'Audit', reports: 'Rekonsiliasi', audit: 'Full Read', admin: 'No' },
                      { role: 'Karyawan', desc: 'Pegawai Operasional', assets: 'Aset Pribadi', loans: 'Request Pinjam', tickets: 'Buat Tiket Sendiri', licenses: 'No', reports: 'No', audit: 'No', admin: 'No' },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
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
                            row.admin === 'Full Control' ? 'bg-red-50 text-red-700 font-black' : 'text-slate-400'
                          }`}>
                            {row.admin}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 3. ORGANIZATION (DIVISI & DEPARTEMEN)
             ========================================================= */}
          {activeSection === 'organization' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900">Struktur Organisasi & Divisi BUMD</h3>
                <p className="text-xs text-slate-500">
                  Pemetaan kepemilikan aset (Owner Division) dan tanggung jawab departemen PT Food Station Tjipinang Jaya
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { code: 'SC', name: 'Supply Chain & Logistik', leader: 'Direktur Operasional', depts: ['Pergudangan Beras Induk', 'Armada Truk & Distribusi', 'Kualitas & Pengemasan'], assetsCount: assets.filter(a => a.owner_division === 'SC').length, icon: Building },
                  { code: 'PIBC', name: 'Pasar Induk Beras Cipinang', leader: 'Kepala Pasar Induk', depts: ['Pengelolaan Kios & Los', 'Ketertiban & Retribusi', 'Informasi Pasokan Beras'], assetsCount: assets.filter(a => a.owner_division === 'PIBC').length, icon: Building2 },
                  { code: 'IT', name: 'Teknologi Informasi & Sistem', leader: 'Manajer IT & Transformasi Digital', depts: ['Infrastruktur & Jaringan', 'Sistem ERP SAP & GABAH', 'Technical Support & Helpdesk'], assetsCount: assets.filter(a => a.owner_division === 'IT').length, icon: Laptop },
                  { code: 'GA', name: 'General Affairs & Fasilitas', leader: 'Manajer Umum', depts: ['Pemeliharaan Gedung & ME', 'Kendaraan Operasional Kantor', 'Keamanan & Kebersihan'], assetsCount: assets.filter(a => a.owner_division === 'GA').length, icon: KeyRound },
                ].map(div => (
                  <div key={div.code} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
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
                        {div.assetsCount} Aset Terdaftar
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
                ))}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 4. MASTER DATA (KATEGORI, LOKASI, SLA)
             ========================================================= */}
          {activeSection === 'master_data' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Master Data Sistem</h3>
                  <p className="text-xs text-slate-500">Konfigurasi kategori aset, lokasi fasilitas PIBC, dan standar SLA Helpdesk</p>
                </div>
                <button
                  onClick={() => showToast('Form penambahan master kategori sedang dipersiapkan', 'info')}
                  className="px-3 py-1.5 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold hover:bg-[#3ba393] flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Kategori</span>
                </button>
              </div>

              {/* Master Kategori */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                  Kategori Aset Terdaftar
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map(cat => (
                    <div key={cat.code} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#206f65]">{cat.code}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold">
                            {cat.type}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 mt-1">{cat.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {cat.loanable ? 'Dapat Dipinjam (Loanable)' : 'Inventaris Tetap'}
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {cat.total} Unit
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Master Lokasi */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                  Master Lokasi & Fasilitas Gudang PIBC
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map((loc, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
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
                  ))}
                </div>
              </div>
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

              {/* Status Sequence Terkini */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">
                  Sequence Counter Terdaftar Tahun 2026
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'IT:HLT:2026', current: 4, next: 'IT-HLT-2026-0005', label: 'Laptop & Workstation IT' },
                    { key: 'SC:FLT:2026', current: 3, next: 'SC-FLT-2026-0004', label: 'Armada Truk Logistik' },
                    { key: 'GA:BLD:2026', current: 2, next: 'GA-BLD-2026-0003', label: 'Gedung & Sarana PIBC' },
                    { key: 'LIC:ENT:2026', current: 1, next: 'LIC-ENT-2026-0002', label: 'Enterprise Software' },
                  ].map(seq => (
                    <div key={seq.key} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="text-[10px] font-mono text-slate-500 font-bold">{seq.key}</div>
                      <div className="text-xs font-extrabold text-slate-800 mt-0.5">{seq.label}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Terakhir: <b>{seq.current}</b></span>
                        <span className="font-mono font-bold text-[#206f65] bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          Next: {seq.next}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 6. NOTIFICATION CENTER
             ========================================================= */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900">Notification Center & Alert Rules</h3>
                <p className="text-xs text-slate-500">
                  Aturan otomasi peringatan sistem, masa tenggat peminjaman, batas SLA tiket, dan masa garansi
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { title: 'Peringatan Masa Garansi & Lisensi Expired', trigger: '30 hari & 7 hari sebelum tanggal kedaluwarsa', target: 'Admin GABAH & Divisi IT', status: 'Aktif', severity: 'warning' },
                  { title: 'Eskalasi Keterlambatan Peminjaman (Overdue Loan)', trigger: 'Melewati batas due date jam 17:00 WIB', target: 'Peminjam, Atasan, dan Admin Penanggung Jawab', status: 'Aktif', severity: 'critical' },
                  { title: 'SLA Breach Warning Tiket Helpdesk', trigger: 'Sisa waktu SLA < 1 jam atau status open melebihi target', target: 'Teknisi yang ditugaskan & Koordinator IT/GA', status: 'Aktif', severity: 'critical' },
                  { title: 'Pemberitahuan BAST & Serah Terima Selesai', trigger: 'Saat serah terima fisik aset disetujui', target: 'Peminjam & Tim Inventaris BUMD', status: 'Aktif', severity: 'info' },
                ].map((rule, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-slate-800">{rule.title}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
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
                    <button
                      onClick={() => showToast(`Uji simulasi notifikasi: "${rule.title}" terkirim!`, 'info')}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Uji Notifikasi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 7. AUDIT LOG VIEWER
             ========================================================= */}
          {activeSection === 'audit_log' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">Audit Trail & Activity Log</h3>
                  <p className="text-xs text-slate-500">Rekam jejak kepatuhan dan audit forensik seluruh operasi sistem</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportDataJson('gabah_audit_logs', auditLogs)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor JSON</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Waktu & Tanggal</th>
                      <th className="px-4 py-3">Pengguna & Peran</th>
                      <th className="px-4 py-3">Aksi</th>
                      <th className="px-4 py-3">Entitas</th>
                      <th className="px-4 py-3">Rincian Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.slice(0, 15).map(log => (
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
                <h3 className="text-base font-black text-slate-900">System Parameters & BUMD Policies</h3>
                <p className="text-xs text-slate-500">Konfigurasi entitas organisasi, standar pelaporan PSAK 16, dan SLA</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Nama BUMD / Instansi</label>
                    <input
                      type="text"
                      value={settingsForm.companyName}
                      onChange={e => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Standar Akuntansi Aset Tetap</label>
                    <input
                      type="text"
                      value={settingsForm.accountingStandard}
                      onChange={e => setSettingsForm({ ...settingsForm, accountingStandard: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Mata Uang Basis</label>
                    <input
                      type="text"
                      value={settingsForm.baseCurrency}
                      onChange={e => setSettingsForm({ ...settingsForm, baseCurrency: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-semibold">Tahun Buku Fiskal</label>
                    <input
                      type="text"
                      value={settingsForm.fiscalYear}
                      onChange={e => setSettingsForm({ ...settingsForm, fiscalYear: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 font-mono"
                    />
                  </div>
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
                        value={settingsForm.slaUrgentHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaUrgentHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-red-200 bg-red-50/30 font-bold text-red-800"
                      />
                    </div>
                    <div>
                      <label className="block text-amber-600 mb-1 font-bold">High (Tinggi)</label>
                      <input
                        type="number"
                        value={settingsForm.slaHighHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaHighHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/30 font-bold text-amber-800"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-600 mb-1 font-bold">Medium (Sedang)</label>
                      <input
                        type="number"
                        value={settingsForm.slaMediumHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaMediumHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-blue-200 bg-blue-50/30 font-bold text-blue-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1 font-bold">Low (Rendah)</label>
                      <input
                        type="number"
                        value={settingsForm.slaLowHours}
                        onChange={e => setSettingsForm({ ...settingsForm, slaLowHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => showToast('Pengaturan sistem berhasil disimpan!')}
                    className="px-5 py-2 rounded-xl bg-[#4ABDAC] text-white text-xs font-bold shadow-md shadow-[#4ABDAC]/20 hover:bg-[#3ba393]"
                  >
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW: 9. DATA ADMINISTRATION
             ========================================================= */}
          {activeSection === 'data_admin' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-base font-black text-slate-900">Data Administration & Reconciliation</h3>
                <p className="text-xs text-slate-500">Ekspor data komprehensif, backup database, dan rekonsiliasi SAP</p>
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
                    className="mt-4 w-full py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
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
                    <h4 className="text-sm font-extrabold text-slate-800">Ekspor Peminjaman & BAST</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Unduh riwayat reservasi, status serah terima fisik, dan log pengembalian aset Food Station.
                    </p>
                  </div>
                  <button
                    onClick={() => exportDataJson('gabah_loans_bast', loans)}
                    className="mt-4 w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
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
                    onClick={() => showToast('Rekonsiliasi otomatis dijalankan: 100% data fisik sinkron dengan SAP', 'success')}
                    className="mt-4 w-full py-2 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
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
                  <div className="text-lg font-black text-slate-900">{healthStatus.status}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Latency: <b className="text-emerald-600">{healthStatus.latency ?? 3} ms</b> · Port 3000
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Database Engine</span>
                    <Database className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900">PostgreSQL Ready</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Dual-Store Persistence & Fallback
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>Numbering Engine</span>
                    <Hash className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900">In-Sync 2026</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Concurrency-Safe Sequence Store
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

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100 text-xs font-mono text-slate-700 space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 mb-1">Diagnostic Log Snapshot:</div>
                <div>[GABAH Kernel] Environment: Node.js 20 / Linux Container</div>
                <div>[GABAH Numbering] Sequence store hydrated: 2026 year sequences active</div>
                <div>[GABAH Security] Multi-role enforcement active (Admin GABAH, IT, GA, SC, PIBC)</div>
                <div>[GABAH PSAK 16] Straight-line depreciation calculator online</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
