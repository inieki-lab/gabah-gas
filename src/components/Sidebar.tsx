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
import { AppNavTab, isNavTabAllowedForRole, isSuperadminNavigationAllowed, isStaffNavigationPersona } from '../navigation/roleNavigation';

export type NavTab = AppNavTab;

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userRole?: UserRole;
  currentUserRole?: UserRole;
  currentUserRoleKeys?: string[];
  currentUserPermissions?: string[];
  currentUserIsSuperAdmin?: boolean;
  activeModuleKeys?: string[] | null;
  onModulesChanged?: () => Promise<void> | void;
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
  currentUserRoleKeys,
  currentUserPermissions,
  currentUserIsSuperAdmin = false,
  activeModuleKeys,
  onModulesChanged,
  pendingLoansCount = 0,
  openTicketsCount = 0,
  pendingReservationsCount = 0,
  documentationRequestsCount = 0,
  itFacilitiesCount = 0,
  gaRequestsCount = 0,
  onOpenAdministration,
}) => {
  const activeRole = currentUserRole || userRole;
  const hasPermissionMetadata = Array.isArray(currentUserPermissions);
  const isSuperAdmin = isSuperadminNavigationAllowed(activeRole, currentUserIsSuperAdmin, currentUserPermissions);
  const hasPermission = (permission: string, legacyRoles: string[] = []) => isSuperAdmin
    || (hasPermissionMetadata
      ? currentUserPermissions!.includes('*') || currentUserPermissions!.includes(permission)
      : (!!activeRole && legacyRoles.includes(activeRole)) || legacyRoles.some(role => currentUserRoleKeys?.includes(role.toLowerCase().replace(/[^a-z0-9]+/g, '_')) === true));
  // Queue badges and labels follow effective capabilities in PostgreSQL mode.
  // Legacy role keys are only a file-store compatibility fallback.
  // Superadmin is a global system persona, not a Humas/Sekdir persona just because its wildcard grants every permission.
  const isHumas = !isSuperAdmin && hasPermission('room_reservations.documentation.read', ['Humas']);
  const isSekdir = !isSuperAdmin && hasPermission('room_reservations.override_priority', ['Sekretaris Direksi']);
  const isIT = hasPermission('room_reservations.it_facilities.read', ['IT', 'Admin GABAH']);
  const isGA = hasPermission('room_reservations.approve', ['GA', 'Admin GABAH'])
    || hasPermission('room_reservations.reject', ['GA', 'Admin GABAH'])
    || hasPermission('meeting_facilities.manage', ['GA', 'Admin GABAH']);
  const isAuditor = !isSuperAdmin && currentUserRoleKeys?.includes('auditor') === true;
  const isStaff = !isAuditor && (isStaffNavigationPersona(activeRole, currentUserPermissions) || isSekdir || isHumas);
  const [showAdministration, setShowAdministration] = useState(false);

  const sections: NavSectionConfig[] = [
    {
      title: isAuditor ? 'Audit & Pemantauan' : isStaff ? 'Layanan & Tugas Staf' : 'Operasional Utama',
      items: [
        {
          id: 'dashboard',
          label: isAuditor ? 'Dashboard Auditor' : isHumas ? 'Dashboard Humas' : isStaff ? 'Dashboard Staf' : 'Dashboard KPI',
          description: isAuditor ? 'Pemantauan Read-only' : isHumas ? 'Ringkasan & Request Foto' : isStaff ? 'Ringkasan & Status' : 'Overview SLA & Aset',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'my_assets',
          label: 'Aset Saya',
          description: isStaff ? 'Perangkat Kerja Anda' : 'Aset Ditugaskan',
          icon: Laptop,
          badge: null,
        },
        {
          id: 'meeting_rooms',
          label: isHumas ? 'Ruang Rapat & Liputan' : isStaff ? 'Ruang Rapat' : 'Reservasi Ruangan',
          description: isHumas ? 'Jadwal & Request Liputan' : isStaff ? 'Jadwal & Booking Ruang' : 'Jadwal & Fasilitas GA/IT',
          icon: isHumas ? Camera : Building2,
          badge: isHumas
            ? (documentationRequestsCount > 0 ? `${documentationRequestsCount} Foto` : null)
            : isIT && itFacilitiesCount > 0
            ? `${itFacilitiesCount} IT`
            : isGA && (gaRequestsCount > 0 || pendingReservationsCount > 0)
            ? (gaRequestsCount || pendingReservationsCount)
            : null,
          badgeColor: isHumas || isIT
            ? 'bg-sky-600 text-white'
            : 'bg-emerald-600 text-white',
        },
        {
          id: 'loans',
          label: isStaff ? 'Pinjam Barang' : 'Peminjaman Barang',
          description: 'Sirkulasi & BAST',
          icon: CalendarClock,
          badge: pendingLoansCount > 0 && !isStaff && !isAuditor ? pendingLoansCount : null,
          badgeColor: 'bg-[#F7B733] text-slate-900',
        },
        {
          id: 'tickets',
          label: isStaff ? 'Tiket Helpdesk' : 'Helpdesk & Tiket',
          description: isStaff ? 'Bantuan Kendala' : 'Insiden & SLA',
          icon: LifeBuoy,
          badge: openTicketsCount > 0 && !isStaff && !isAuditor ? openTicketsCount : null,
          badgeColor: 'bg-[#FC4A1A] text-white',
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
        },
        {
          id: 'maintenance',
          label: 'Maintenance',
          description: 'Pemeliharaan & permintaan servis',
          icon: Wrench,
          badge: 'Rutin',
          badgeColor: 'bg-amber-100 text-amber-800 border border-amber-300',
        },
        {
          id: 'licenses',
          label: 'Software & SaaS',
          description: 'Seat & Expiry',
          icon: KeyRound,
          badge: null,
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
        },
        {
          id: 'contracts',
          label: 'Contract Management',
          description: 'Register & Reminder Kontrak',
          icon: FileText,
          badge: null,
        },
        {
          id: 'knowledge',
          label: 'Knowledge Base',
          description: 'Panduan & SOP',
          icon: BookOpen,
          badge: null,
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
        },
      ],
    },
  ];

  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => activeRole
        ? isNavTabAllowedForRole(activeRole, item.id, currentUserPermissions)
          && (Array.isArray(activeModuleKeys) && activeModuleKeys.includes(item.id))
        : false),
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      <aside aria-label="Navigasi utama GABAH" className="gabah-sidebar w-64 bg-white border-r border-[#e1ebe4] flex flex-col shrink-0 min-h-[calc(100vh-4rem)] shadow-xs">
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
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onTabChange(item.id)}
                    className={`gabah-nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                      isActive
                        ? 'bg-[#e5f4eb] text-[#176b45] ring-1 ring-inset ring-[#cfe7d8] font-bold'
                        : 'text-slate-600 hover:text-[#176b45] hover:bg-[#edf6ef] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-[#176b45]' : 'text-slate-500 group-hover:text-[#218653]'
                        }`}
                      />
                      <div className="truncate">
                        <div className="text-xs leading-tight truncate">{item.label}</div>
                        {item.description && (
                          <div
                            className={`text-[10px] truncate leading-tight mt-0.5 ${
                              isActive ? 'text-[#397657]' : 'text-slate-400'
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
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all group text-slate-700 hover:text-[#176b45] hover:bg-[#edf6ef] font-bold border border-[#dce9df]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#218653]" />
                  <div className="truncate">
                    <div className="text-xs leading-tight truncate">Administration Control Panel</div>
                    <div className="text-[10px] leading-tight mt-0.5 text-slate-400 truncate">
                      10 Sub-Modul Kontrol &amp; Konfigurasi
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0 bg-[#e5f4eb] text-[#176b45] border-[#cfe7d8]">
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
          onModulesChanged={onModulesChanged}
        />
      )}
    </>
  );
};
