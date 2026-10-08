import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  CalendarClock, 
  LifeBuoy, 
  KeyRound, 
  Briefcase, 
  BookOpen, 
  BarChart3, 
  ShieldCheck,
  Users,
  LockKeyhole,
  Building2,
  Database,
  Bell,
  ScrollText,
  FileText,
  Settings2,
  Hash,
  HeartPulse,
  Laptop,
  FolderKanban,
  ChevronRight,
  Layers,
  Wrench,
  Camera,
  X
} from 'lucide-react';
import { UserRole } from '../types';
import { AdministrationModal } from './modals/AdministrationModal';

export type NavTab = 
  | 'dashboard'
  | 'my_assets'
  | 'meeting_rooms'
  | 'assets'
  | 'maintenance'
  | 'loans'
  | 'tickets'
  | 'licenses'
  | 'contracts'
  | 'vendors'
  | 'knowledge'
  | 'reports';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userRole?: UserRole;
  currentUserRole?: UserRole;
  pendingLoansCount?: number;
  openTicketsCount?: number;
  pendingReservationsCount?: number;
  documentationRequestsCount?: number;
  itFacilitiesCount?: number;
  gaRequestsCount?: number;
  onOpenAdministration?: () => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  badgeColor?: string;
  roles: UserRole[];
}

interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  userRole,
  currentUserRole,
  pendingLoansCount = 0,
  openTicketsCount = 0,
  pendingReservationsCount = 0,
  documentationRequestsCount = 0,
  itFacilitiesCount = 0,
  gaRequestsCount = 0,
  onOpenAdministration,
}) => {
  const activeRole = currentUserRole || userRole || 'Admin GABAH';
  const isStaff = ['Karyawan', 'Sekretaris Direksi', 'Humas'].includes(activeRole);
  const isHumas = activeRole === 'Humas';
  const isSekdir = activeRole === 'Sekretaris Direksi';
  const isSuperAdmin = activeRole === 'Admin GABAH';
  const [showAdministration, setShowAdministration] = useState(false);

  const sections: NavSectionConfig[] = [
    {
      title: isStaff ? 'Layanan & Tugas Staf' : 'Operasional Utama',
      items: [
        {
          id: 'dashboard',
          label: isHumas ? 'Dashboard Humas' : isStaff ? 'Dashboard Staf' : 'Dashboard KPI',
          description: isHumas ? 'Ringkasan & Request Foto' : isStaff ? 'Ringkasan & Status' : 'Overview SLA & Aset',
          icon: LayoutDashboard,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
        {
          id: 'my_assets',
          label: 'Aset Saya',
          description: isStaff ? 'Perangkat Kerja Anda' : 'Aset Ditugaskan',
          icon: Laptop,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
        {
          id: 'meeting_rooms',
          label: isHumas ? 'Ruang Rapat & Liputan' : isStaff ? 'Ruang Rapat' : 'Reservasi Ruangan',
          description: isHumas ? 'Jadwal & Request Liputan' : isStaff ? 'Jadwal & Booking Ruang' : 'Jadwal & Fasilitas GA/IT',
          icon: isHumas ? Camera : Building2,
          badge: isHumas
            ? (documentationRequestsCount > 0 ? `${documentationRequestsCount} Foto` : null)
            : (activeRole === 'IT' && itFacilitiesCount > 0)
            ? `${itFacilitiesCount} IT`
            : (activeRole === 'GA' || activeRole === 'Admin GABAH') && (gaRequestsCount > 0 || pendingReservationsCount > 0)
            ? (gaRequestsCount || pendingReservationsCount)
            : null,
          badgeColor: isHumas 
            ? 'bg-sky-600 text-white' 
            : activeRole === 'IT'
            ? 'bg-sky-600 text-white'
            : 'bg-emerald-600 text-white',
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
        {
          id: 'loans',
          label: isStaff ? 'Pinjam Barang' : 'Peminjaman Barang',
          description: 'Sirkulasi & BAST',
          icon: CalendarClock,
          badge: pendingLoansCount > 0 && !isStaff ? pendingLoansCount : null,
          badgeColor: 'bg-[#F7B733] text-slate-900',
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
        {
          id: 'tickets',
          label: isStaff ? 'Tiket Helpdesk' : 'Helpdesk & Tiket',
          description: isStaff ? 'Bantuan Kendala' : 'Insiden & SLA',
          icon: LifeBuoy,
          badge: openTicketsCount > 0 && !isStaff ? openTicketsCount : null,
          badgeColor: 'bg-[#FC4A1A] text-white',
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
      ],
    },
    {
      title: 'Manajemen Inventaris',
      items: [
        {
          id: 'assets',
          label: 'Aset',
          description: 'Katalog & pengelolaan aset sesuai scope',
          icon: Package,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC', 'Auditor'],
        },
        {
          id: 'maintenance',
          label: 'Maintenance',
          description: 'Pemeliharaan & permintaan servis',
          icon: Wrench,
          badge: 'Rutin',
          badgeColor: 'bg-amber-100 text-amber-800 border border-amber-300',
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
        {
          id: 'licenses',
          label: 'Software & SaaS',
          description: 'Seat & Expiry',
          icon: KeyRound,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'Auditor'],
        },
      ],
    },
    {
      title: isStaff ? 'Informasi & Panduan' : 'Tata Kelola & Rekanan',
      items: [
        {
          id: 'vendors',
          label: 'Vendor Rekanan',
          description: 'Kontrak Servis & Mitra',
          icon: Briefcase,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Auditor'],
        },
        {
          id: 'contracts',
          label: 'Contract Management',
          description: 'Register & Reminder Kontrak',
          icon: FileText,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC', 'Auditor'],
        },
        {
          id: 'knowledge',
          label: 'Knowledge Base',
          description: 'Panduan & SOP',
          icon: BookOpen,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'],
        },
      ],
    },
    {
      title: 'Sistem & Analitik',
      items: [
        {
          id: 'reports',
          label: 'Laporan & Audit',
          description: 'Depresiasi & SLA',
          icon: BarChart3,
          badge: null,
          roles: ['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC', 'Auditor'],
        },
      ],
    },
  ];

  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(activeRole)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      <aside className="w-64 bg-white border-r border-[#DFDCE3] flex flex-col shrink-0 min-h-[calc(100vh-4rem)] shadow-xs">
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {visibleSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2 pb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {section.title}
                </span>
              </div>

              {section.items.map((item) => {
                const isActive = currentTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all group ${
                      isActive
                        ? 'bg-[#4ABDAC] text-white shadow-md shadow-[#4ABDAC]/25 font-bold'
                        : 'text-slate-600 hover:text-[#206f65] hover:bg-[#4ABDAC]/10 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-[#4ABDAC]'
                        }`}
                      />
                      <div className="truncate">
                        <div className="text-xs leading-tight truncate">{item.label}</div>
                        {item.description && (
                          <div
                            className={`text-[10px] truncate leading-tight mt-0.5 ${
                              isActive ? 'text-white/80' : 'text-slate-400'
                            }`}
                          >
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {item.badge !== null && item.badge !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {isSuperAdmin && (
            <div className="pt-2 border-t border-slate-100 space-y-1">
              <div className="px-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Pusat Administrasi
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Super Admin Only
                </span>
              </div>
              <button
                id="nav-item-administration"
                onClick={() => {
                  if (onOpenAdministration) {
                    onOpenAdministration();
                  } else {
                    setShowAdministration(true);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all group text-slate-700 hover:text-[#206f65] hover:bg-[#4ABDAC]/10 font-bold border border-slate-200"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#4ABDAC]" />
                  <div className="truncate">
                    <div className="text-xs leading-tight truncate">Administration Control Panel</div>
                    <div className="text-[10px] leading-tight mt-0.5 text-slate-400 truncate">
                      10 Sub-Modul Kontrol &amp; Konfigurasi
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-[#4ABDAC]/15 text-[#206f65] border-[#4ABDAC]/30">
                  Super Admin
                </span>
              </button>
            </div>
          )}
        </nav>
      </aside>

      {showAdministration && (
        <AdministrationModal
          isOpen={showAdministration}
          onClose={() => setShowAdministration(false)}
          users={[]}
          auditLogs={[]}
          assets={[]}
          loans={[]}
          tickets={[]}
          showToast={(msg) => console.log(msg)}
        />
      )}
    </>
  );
};
