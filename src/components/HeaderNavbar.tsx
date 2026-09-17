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
  LogOut 
} from 'lucide-react';
import { UserProfile, UserRole, Ticket, Loan } from '../types';

interface HeaderNavbarProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenArchitectureModal: () => void;
  onOpenScannerModal: () => void;
  onOpenGlobalSearch?: () => void;
  onLogout: () => void;
  pendingLoans: Loan[];
  urgentTickets: Ticket[];
  onNavigateToLoans: () => void;
  onNavigateToTickets: () => void;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  onOpenArchitectureModal,
  onOpenScannerModal,
  onOpenGlobalSearch,
  onLogout,
  pendingLoans = [],
  urgentTickets = [],
  onNavigateToLoans,
  onNavigateToTickets,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const safeLoans = Array.isArray(pendingLoans) ? pendingLoans : [];
  const safeTickets = Array.isArray(urgentTickets) ? urgentTickets : [];
  const totalNotifications = safeLoans.length + safeTickets.length;

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

            {/* Dropdown Menu for Roles */}
            {showRoleDropdown && (
              <div 
                className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" /> Switch Role Persona (RBAC)
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Uji coba akses per role secara langsung</p>
                </div>

                <div className="space-y-1">
                  {allUsers.map(user => {
                    const isSelected = user.id === currentUser.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          onSelectUser(user);
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg flex items-center gap-3 transition-colors ${
                          isSelected 
                            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' 
                            : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate text-slate-900">{user.name}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="text-emerald-700 font-semibold">{user.role_label}</span>
                            <span>•</span>
                            <span className="truncate">{user.department}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
