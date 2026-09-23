import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  Bell, 
  Shield, 
  Code2, 
  ChevronDown, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Laptop, 
  Clock,
  ScanLine,
  Camera,
  LogOut 
} from 'lucide-react';
import { UserProfile, UserRole, Ticket, Loan, RoomReservation } from '../types';

interface HeaderNavbarProps {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onSwitchRoleSimulation?: (role: UserRole) => void;
  onOpenArchitectureModal: () => void;
  onOpenScannerModal: () => void;
  onOpenGlobalSearch?: () => void;
  onLogout: () => void;
  pendingLoans?: Loan[];
  urgentTickets?: Ticket[];
  roomReservations?: RoomReservation[];
  onNavigateToLoans: () => void;
  onNavigateToTickets: () => void;
  onNavigateToMeetingRooms?: (categoryFilter?: 'all' | 'consumption' | 'documentation') => void;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  currentUser,
  allUsers = [],
  onSelectUser,
  onSwitchRoleSimulation,
  onOpenArchitectureModal,
  onOpenScannerModal,
  onOpenGlobalSearch,
  onLogout,
  pendingLoans = [],
  urgentTickets = [],
  roomReservations = [],
  onNavigateToLoans,
  onNavigateToTickets,
  onNavigateToMeetingRooms,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const safeLoans = Array.isArray(pendingLoans) ? pendingLoans : [];
  const safeTickets = Array.isArray(urgentTickets) ? urgentTickets : [];
  const isHumas = currentUser.role === 'Humas';
  // Photo & documentation request notifications are strictly for Humas employees only
  const docReservations = isHumas
    ? (roomReservations || []).filter(
        r => r.documentation_requested && !['cancelled', 'rejected'].includes(r.status)
      )
    : [];

  const totalNotifications = isHumas 
    ? docReservations.length + safeLoans.length + safeTickets.length
    : safeLoans.length + safeTickets.length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#DFDCE3] text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#4ABDAC] flex items-center justify-center shadow-md shadow-[#4ABDAC]/25">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-slate-900">GABAH</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#4ABDAC]/15 text-[#2d7f74] border border-[#4ABDAC]/30">
                FOOD STATION
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">General Asset, Business &amp; Automated Helpdesk</p>
          </div>
        </div>

        {/* Center: Global Search Omnibox Trigger */}
        {onOpenGlobalSearch && (
          <div className="flex-1 max-w-md mx-2 hidden md:block">
            <button
              onClick={onOpenGlobalSearch}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 border border-slate-200/80 text-xs text-slate-500 hover:text-slate-800 transition-all group shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-400 group-hover:text-[#4ABDAC] transition-colors" />
                <span>Cari nomor aset, tiket, atau peminjaman...</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                <span>Ctrl</span>
                <span>K</span>
              </div>
            </button>
          </div>
        )}

        {/* Right Actions: QR Scanner + Laravel Architecture + Notifications + User Switcher + Logout */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Quick QR & Barcode Scanner Button */}
          <button
            id="btn-scan-qr-header"
            onClick={onOpenScannerModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#4ABDAC]/10 hover:bg-[#4ABDAC]/20 text-[#206f65] border border-[#4ABDAC]/30 text-xs font-semibold transition-all shadow-xs group"
            title="Scan Label Barcode / QR Code Aset"
          >
            <ScanLine className="w-4 h-4 text-[#4ABDAC] group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline">Scan Barcode</span>
          </button>

          {/* Backend Code & Architecture Inspector Button (Only visible for Admin GABAH) */}
          {currentUser.role === 'Admin GABAH' && (
            <>
              <a
                id="btn-download-source-header"
                href="/gabah-source.tar.gz"
                download="gabah-laravel11-source.tar.gz"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F7B733]/15 hover:bg-[#F7B733]/25 text-amber-900 border border-[#F7B733]/40 text-xs font-semibold transition-all shadow-xs group"
                title="Download Source Code Backend Laravel 11 (tar.gz)"
              >
                <Code2 className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
                <span className="hidden xl:inline">Download Backend</span>
                <span className="text-[10px] bg-[#F7B733]/40 text-amber-950 px-1 py-0.2 rounded font-bold">.tar.gz</span>
              </a>

              <button
                id="btn-laravel-architecture"
                onClick={onOpenArchitectureModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold transition-all shadow-xs group"
                title="Lihat Arsitektur Laravel 11, Service Layer & Database Migration"
              >
                <Code2 className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
                <span className="hidden md:inline">Laravel 11 Backend</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold">PHP 8.3</span>
              </button>
            </>
          )}

          {/* Notifications Popover */}
          <div className="relative">
            <button
              id="btn-notifications"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FC4A1A] text-white text-xs font-bold rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                  {totalNotifications}
                </span>
              )}
            </button>

            {showNotifications && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-50"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    Notifikasi Sistem ({totalNotifications})
                  </h4>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Tutup
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto mt-2 space-y-2">
                  {/* Photo / Documentation Requests - Strictly for Humas employees only */}
                  {isHumas && docReservations.map(res => (
                    <div 
                      key={`doc-${res.id}`}
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigateToMeetingRooms?.('documentation');
                      }}
                      className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100/70 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-sky-800 flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-sky-600" /> Request Foto: {res.room_name}
                        </span>
                        <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">{res.date}</span>
                      </div>
                      <p className="text-xs text-slate-800 font-semibold line-clamp-1">{res.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {res.start_time} - {res.end_time} WIB • {res.organizer_name} ({res.organizer_department})
                      </p>
                      {res.documentation_notes && (
                        <p className="text-[11px] text-sky-700 italic mt-0.5 bg-sky-100/50 px-1.5 py-0.5 rounded">
                          "{res.documentation_notes}"
                        </p>
                      )}
                    </div>
                  ))}

                  {urgentTickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigateToTickets();
                      }}
                      className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100/70 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> SLA URGENT ({ticket.ticket_code})
                        </span>
                        <span className="text-slate-500 font-medium">SLA 4 Jam</span>
                      </div>
                      <p className="text-xs text-slate-800 line-clamp-2">{ticket.title}</p>
                    </div>
                  ))}

                  {pendingLoans.map(loan => (
                    <div 
                      key={loan.id}
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigateToLoans();
                      }}
                      className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100/70 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-amber-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Permintaan Peminjaman ({loan.loan_number})
                        </span>
                        <span className="text-slate-500">{loan.category_type}</span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{loan.asset_name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Pemohon: {loan.borrower_name} ({loan.borrower_department})</p>
                    </div>
                  ))}

                  {totalNotifications === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      Semua antrean tiket dan peminjaman dalam kondisi bersih.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Granular RBAC Role Switcher (Clean White) */}
          <div className="relative">
            <button
              id="btn-user-role-dropdown"
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-left shadow-xs"
            >
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name} 
                className="w-8 h-8 rounded-lg object-cover ring-1 ring-emerald-600" 
              />
              <div className="hidden lg:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{currentUser.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {currentUser.role_label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{currentUser.department}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu for Roles & Simulation */}
            {showRoleDropdown && (
              <div 
                className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 z-50 max-h-[85vh] overflow-y-auto"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" /> Switch Role & Persona
                    </p>
                    {currentUser.id.startsWith('SIM-') && (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Mode Simulasi
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Uji coba akses dan tampilan per role secara langsung</p>
                </div>

                {/* Section 1: Registered Users in Database */}
                <div className="mb-3">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                    Akun Terdaftar ({(allUsers || []).length})
                  </div>
                  <div className="space-y-1">
                    {(allUsers || []).map(user => {
                      const isSelected = user.id === currentUser.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            onSelectUser(user);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl flex items-center gap-2.5 transition-colors ${
                            isSelected 
                              ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' 
                              : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate text-slate-900">{user.name}</span>
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                              <span className="text-emerald-700 font-bold">{user.role}</span>
                              <span>•</span>
                              <span className="truncate">{user.department}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Role Simulation (Fast testing for all menus across all users) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
                    <span>Simulasi Cek Menu (RBAC)</span>
                    <span className="text-[9px] font-normal text-slate-400">9 Peran</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { role: 'Admin GABAH' as UserRole, label: 'Super Admin', color: 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' },
                      { role: 'Karyawan' as UserRole, label: 'Karyawan / Staf', color: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' },
                      { role: 'Sekretaris Direksi' as UserRole, label: 'Sekretaris Direksi', color: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100' },
                      { role: 'Humas' as UserRole, label: 'Staf Humas', color: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' },
                      { role: 'GA' as UserRole, label: 'GA & Sarpras', color: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' },
                      { role: 'IT' as UserRole, label: 'IT Support', color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
                      { role: 'Supply Chain' as UserRole, label: 'Supply Chain', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                      { role: 'PIBC' as UserRole, label: 'Pasar PIBC', color: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                      { role: 'Auditor' as UserRole, label: 'Auditor SPI', color: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
                    ].map(item => {
                      const isActive = currentUser.role === item.role;
                      return (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => {
                            if (onSwitchRoleSimulation) {
                              onSwitchRoleSimulation(item.role);
                            } else {
                              const found = (allUsers || []).find(u => u.role === item.role);
                              if (found) onSelectUser(found);
                            }
                            setShowRoleDropdown(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold text-left transition-all flex items-center justify-between ${item.color} ${
                            isActive ? 'ring-2 ring-emerald-500 font-extrabold shadow-xs' : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {isActive && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Back to Real Super Admin Button if in simulation mode */}
                {currentUser?.id?.startsWith('SIM-') && (allUsers || []).length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        if (allUsers && allUsers[0]) {
                          onSelectUser(allUsers[0]);
                        }
                        setShowRoleDropdown(false);
                      }}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Kembali ke Akun Super Admin ({allUsers?.[0]?.name || 'Admin'})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
            title="Keluar / Logout ke Beranda"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};
