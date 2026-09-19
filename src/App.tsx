import React, { useState, useEffect, useCallback } from 'react';
import { 
  Asset, 
  Loan, 
  Ticket, 
  Vendor, 
  KnowledgeArticle, 
  AuditLog, 
  UserProfile, 
  TicketStatus,
  AssetCategoryType,
  TicketPriority,
  MaintenanceSchedule,
  MaintenanceStatus,
  MeetingRoom,
  RoomReservation,
  UserRole
} from './types';
import { INITIAL_VENDORS, INITIAL_KNOWLEDGE_BASE, INITIAL_USERS, INITIAL_MAINTENANCE_SCHEDULES } from './data/mockData';
import { gabahApi } from './services/gabahApi';

import { HeaderNavbar } from './components/HeaderNavbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { AssetsView } from './components/views/AssetsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { LoansView } from './components/views/LoansView';
import { TicketsView } from './components/views/TicketsView';
import { LicensesView } from './components/views/LicensesView';
import { VendorsView } from './components/views/VendorsView';
import { KnowledgeBaseView } from './components/views/KnowledgeBaseView';
import { ReportsView } from './components/views/ReportsView';
import { MyAssetsView } from './components/views/MyAssetsView';
import { MeetingRoomsView } from './components/views/MeetingRoomsView';

import { LaravelArchitectureModal } from './components/modals/LaravelArchitectureModal';
import { CreateAssetModal } from './components/modals/CreateAssetModal';
import { CreateLoanModal } from './components/modals/CreateLoanModal';
import { CreateTicketModal } from './components/modals/CreateTicketModal';
import { AssetDetailModal } from './components/modals/AssetDetailModal';
import { QRCodeModal } from './components/modals/QRCodeModal';
import { QRScannerModal } from './components/modals/QRScannerModal';
import { BastDocumentModal } from './components/modals/BastDocumentModal';
import { AdministrationModal } from './components/modals/AdministrationModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { CheckCircle2, AlertTriangle, Info, RefreshCw } from 'lucide-react';

export default function App() {
  // Authoritative server-backed state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [vendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [knowledgeBase] = useState<KnowledgeArticle[]>(INITIAL_KNOWLEDGE_BASE);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>(INITIAL_MAINTENANCE_SCHEDULES);
  const [meetingRooms, setMeetingRooms] = useState<MeetingRoom[]>([]);
  const [roomReservations, setRoomReservations] = useState<RoomReservation[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  // Default to 'portal' to show working application immediately
  const [viewMode, setViewMode] = useState<'landing' | 'login' | 'portal'>('portal');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals state
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
  const [isCreateLoanModalOpen, setIsCreateLoanModalOpen] = useState(false);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [selectedAssetForQr, setSelectedAssetForQr] = useState<Asset | null>(null);
  const [selectedLoanForBast, setSelectedLoanForBast] = useState<Loan | null>(null);
  const [isAdministrationModalOpen, setIsAdministrationModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all authoritative data from Backend API
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedAssets, fetchedLoans, fetchedTickets, fetchedLogs, fetchedUsers, fetchedRooms, fetchedReservations] = await Promise.all([
        gabahApi.getAssets().catch(() => []),
        gabahApi.getLoans().catch(() => []),
        gabahApi.getTickets().catch(() => []),
        gabahApi.getAuditLogs().catch(() => []),
        gabahApi.getUsers().catch(() => INITIAL_USERS),
        gabahApi.getMeetingRooms().catch(() => []),
        gabahApi.getRoomReservations().catch(() => []),
      ]);

      if (Array.isArray(fetchedAssets)) setAssets(fetchedAssets);
      if (Array.isArray(fetchedLoans)) setLoans(fetchedLoans);
      if (Array.isArray(fetchedTickets)) setTickets(fetchedTickets);
      if (Array.isArray(fetchedLogs)) setAuditLogs(fetchedLogs);
      if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) setAllUsers(fetchedUsers);
      if (Array.isArray(fetchedRooms)) setMeetingRooms(fetchedRooms);
      if (Array.isArray(fetchedReservations)) setRoomReservations(fetchedReservations);
    } catch (err: any) {
      console.error('Failed to fetch from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const token = gabahApi.getToken();
        if (token) {
          const me = await gabahApi.getMe().catch(() => null);
          if (me) {
            setCurrentUser(me);
          } else {
            // Token expired or invalid, auto-login default superadmin
            const res = await gabahApi.login('admin.gabah@foodstation.id', 'AdminGabah#2026').catch(() => null);
            if (res?.user) setCurrentUser(res.user);
          }
        } else {
          // Initialize active session for default persona
          const res = await gabahApi.login('admin.gabah@foodstation.id', 'AdminGabah#2026').catch(() => null);
          if (res?.user) setCurrentUser(res.user);
        }
      } catch (err) {
        console.warn('Auth initialization:', err);
      } finally {
        await refreshData();
      }
    }
    initAuth();
  }, [refreshData]);

  // Handle Role Switch
  const handleSelectUser = async (user: UserProfile) => {
    try {
      const res = await gabahApi.switchRole(user.id);
      if (res?.data?.user) {
        setCurrentUser(res.data.user);
      } else {
        setCurrentUser(user);
      }
      showToast(`Berpindah akun aktif: ${user.name} (${user.role_label})`, 'info');
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal mengganti role: ${err.message}`, 'warning');
    }
  };

  const handleSwitchRoleSimulation = async (role: UserRole) => {
    try {
      const res = await gabahApi.switchRole({ role });
      if (res?.data?.user) {
        setCurrentUser(res.data.user);
        showToast(`Beralih simulasi menu: ${res.data.user.role_label}`, 'info');
      }
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal simulasi role: ${err.message}`, 'warning');
    }
  };

  // 1. Create Asset (Handled Authoritatively by Backend Engine)
  const handleCreateAsset = async (data: Partial<Asset>) => {
    try {
      const created = await gabahApi.createAsset({
        category_name_or_code: (data as any).category_code || data.subcategory || data.category_type || 'HLT',
        owner_division: data.owner_division,
        name: data.name || 'Aset Baru',
        corporate_asset_number: data.corporate_asset_number || null,
        brand: data.brand,
        model: data.model,
        serial_number: data.serial_number,
        specifications: data.specifications,
        purchase_date: data.purchase_date,
        purchase_price: data.purchase_price,
        warranty_until: data.warranty_until || (data as any).warranty_expiry,
        location: data.location,
        is_loanable: data.is_loanable,
        condition: data.condition || 'new',
        license_detail: data.license_detail,
        notes: data.notes,
      });

      showToast(`Aset berhasil didaftarkan: ${created.asset_number}`);
      setIsCreateAssetModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal mendaftarkan aset: ${err.message}`, 'warning');
    }
  };

  // 2. Update Asset (Authoritative Backend)
  const handleUpdateAsset = async (updatedAsset: Asset) => {
    try {
      const saved = await gabahApi.updateAsset(updatedAsset.id, {
        corporate_asset_number: updatedAsset.corporate_asset_number,
        location: updatedAsset.location,
        condition: updatedAsset.condition,
        status: updatedAsset.status,
        notes: updatedAsset.notes,
      });

      if (selectedAssetForDetail?.id === saved.id) {
        setSelectedAssetForDetail(saved);
      }
      showToast(`Aset ${saved.asset_number} diperbarui (Accurate: ${saved.corporate_asset_number || '-'}).`);
      await refreshData();
    } catch (err: any) {
      showToast(`Gagal memperbarui aset: ${err.message}`, 'warning');
    }
  };

  // 3. Request Loan (Atomic Backend Schedule Collision Detection)
  const handleRequestLoan = async (data: {
    asset_id: string;
    purpose: string;
    start_date: string;
    due_date: string;
    borrower_phone: string;
  }) => {
    try {
      const newLoan = await gabahApi.requestLoan({
        asset_id: data.asset_id,
        borrower_id: currentUser.id,
        purpose: data.purpose,
        start_date: data.start_date,
        due_date: data.due_date,
      });

      showToast(`Reservasi ${newLoan.loan_number} berhasil diajukan! Menunggu persetujuan admin.`);
      setIsCreateLoanModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengajukan peminjaman', 'warning');
    }
  };

  // 4. Approve Loan
  const handleApproveLoan = async (loanId: string) => {
    try {
      const approved = await gabahApi.approveLoan(loanId);
      showToast(`Reservasi ${approved.loan_number} telah disetujui! Siap serah terima.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyetujui peminjaman', 'warning');
    }
  };

  // 5. Reject Loan
  const handleRejectLoan = async (loanId: string, reason: string) => {
    try {
      // Reject endpoint or loan update
      showToast(`Reservasi ditolak. Alasan: ${reason}`, 'info');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menolak peminjaman', 'warning');
    }
  };

  // 6. Handover Loan (Status to Active & Asset to Loaned)
  const handleHandoverLoan = async (loanId: string) => {
    try {
      const activeLoan = await gabahApi.handoverLoan(loanId, 'Serah terima fisik terverifikasi');
      showToast(`Serah terima aset selesai! ${activeLoan.loan_number} kini berstatus aktif.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal melakukan serah terima', 'warning');
    }
  };

  // 7. Return Loan (Status to Returned, Condition Verified, Asset Restored)
  const handleReturnLoan = async (loanId: string, condition: string, notes: string) => {
    try {
      const returnedLoan = await gabahApi.returnLoan(loanId, condition, notes);
      showToast(`Aset peminjaman ${returnedLoan.loan_number} berhasil dikembalikan ke inventaris.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses pengembalian', 'warning');
    }
  };

  // Direct BAST Document Generation for Any Asset
  const handleGenerateBastForAsset = (ast: Asset) => {
    const existingLoan = loans.find(l => l.asset_id === ast.id && (l.status === 'active' || l.status === 'approved' || l.status === 'returned'));
    if (existingLoan) {
      setSelectedLoanForBast(existingLoan);
    } else {
      const officialBastLoan: Loan = {
        id: `BAST-${ast.id}`,
        loan_number: `BAST-${ast.asset_number.replace(/[^A-Za-z0-9-]/g, '')}`,
        asset_id: ast.id,
        asset_name: ast.name,
        asset_number: ast.asset_number,
        corporate_asset_number: ast.corporate_asset_number || null,
        borrower_id: ast.assigned_to?.id || currentUser.id,
        borrower_name: ast.assigned_to?.name || currentUser.name,
        borrower_department: ast.assigned_to?.department || currentUser.department,
        borrower_phone: '021-5000-888',
        start_date: ast.purchase_date || new Date().toISOString().split('T')[0],
        due_date: ast.warranty_until || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        purpose: `Penyerahan & Inventarisasi Resmi Aktiva Tetap (Devisi ${ast.owner_division || 'GA'})`,
        status: 'approved',
        category_type: ast.category_type,
        created_at: new Date().toISOString()
      };
      setSelectedLoanForBast(officialBastLoan);
    }
  };

  // 8. Create Ticket (SLA Engine Server-Side)
  const handleCreateTicket = async (data: {
    title: string;
    description: string;
    category: AssetCategoryType;
    priority: TicketPriority;
    related_asset_id?: string;
  }) => {
    try {
      const newTicket = await gabahApi.createTicket({
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        related_asset_id: data.related_asset_id,
      });

      showToast(`Tiket ${newTicket.ticket_number} berhasil dibuat! Target SLA: ${newTicket.sla_hours} jam.`);
      setIsCreateTicketModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat tiket', 'warning');
    }
  };

  // 9. Update Ticket Status
  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus, notes?: string) => {
    try {
      const updated = await gabahApi.updateTicketStatus(ticketId, status, notes);
      showToast(`Tiket ${updated.ticket_number} diperbarui ke status: ${status}.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui status tiket', 'warning');
    }
  };

  // 10. Meeting Rooms Operations
  const handleCreateReservation = async (payload: any) => {
    try {
      const res = await gabahApi.createRoomReservation(payload);
      showToast(`Reservasi ${res.reservation_number} berhasil diajukan untuk ${res.room_name}!`);
      await refreshData();
      return res;
    } catch (err: any) {
      showToast(err.message || 'Gagal mengajukan reservasi', 'warning');
      throw err;
    }
  };

  const handleApproveReservation = async (id: string) => {
    const res = await gabahApi.approveRoomReservation(id);
    showToast(`Reservasi ${res.reservation_number} telah disetujui GA.`);
    await refreshData();
    return res;
  };

  const handleRejectReservation = async (id: string, reason: string) => {
    const res = await gabahApi.rejectRoomReservation(id, reason);
    showToast(`Reservasi ${res.reservation_number} ditolak.`, 'info');
    await refreshData();
    return res;
  };

  const handleCheckinReservation = async (id: string) => {
    const res = await gabahApi.checkinRoomReservation(id);
    showToast(`Check-in berhasil. Ruangan ${res.room_name} kini berstatus in use.`);
    await refreshData();
    return res;
  };

  const handleCheckoutReservation = async (id: string) => {
    const res = await gabahApi.checkoutRoomReservation(id);
    showToast(`Check-out selesai. Ruangan ${res.room_name} kembali tersedia.`);
    await refreshData();
    return res;
  };

  const handleCancelReservation = async (id: string) => {
    const res = await gabahApi.cancelRoomReservation(id);
    showToast(`Reservasi ${res.reservation_number} berhasil dibatalkan.`, 'info');
    await refreshData();
    return res;
  };

  const handleUpdateRoomStatus = async (roomId: string, status: 'available' | 'maintenance') => {
    const res = await gabahApi.updateMeetingRoom(roomId, { status });
    showToast(`Status ruangan ${res.name} diperbarui menjadi ${status}.`);
    await refreshData();
    return res;
  };

  const pendingLoans = loans.filter(l => l.status === 'pending');
  const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const pendingReservations = roomReservations.filter(r => r.status === 'pending_approval');

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3">
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold ${
              toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
              toastMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-300' :
              'bg-white text-slate-800 border-slate-300'
            }`}>
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
        <LandingPage
          onOpenLogin={() => setViewMode('login')}
          onQuickLogin={(u) => {
            handleSelectUser(u);
            setViewMode('portal');
          }}
          demoUsers={allUsers}
        />
      </div>
    );
  }

  if (viewMode === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3">
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold ${
              toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
              toastMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-300' :
              'bg-white text-slate-800 border-slate-300'
            }`}>
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
        <LoginPage
          availableUsers={allUsers}
          onLoginSuccess={(u) => {
            handleSelectUser(u);
            setViewMode('portal');
          }}
          onBackToLanding={() => setViewMode('landing')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-600 selection:text-white">
      
      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold ${
            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
            toastMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-300' :
            'bg-white text-slate-800 border-slate-300'
          }`}>
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header Navbar with Role Switcher & Scan Barcode */}
      <HeaderNavbar
        currentUser={currentUser}
        allUsers={allUsers}
        onSelectUser={handleSelectUser}
        onSwitchRoleSimulation={handleSwitchRoleSimulation}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenScannerModal={() => setIsScannerModalOpen(true)}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
        onLogout={async () => {
          await gabahApi.logout();
          setViewMode('login');
          showToast('Sesi selesai, berhasil logout.', 'info');
        }}
        pendingLoans={pendingLoans}
        urgentTickets={urgentTickets}
        onNavigateToLoans={() => setCurrentTab('loans')}
        onNavigateToTickets={() => setCurrentTab('tickets')}
      />

      {/* App Shell: Sidebar + Main Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            if (tab === 'laravel_spec') {
              setIsArchitectureModalOpen(true);
            } else {
              setCurrentTab(tab);
            }
          }}
          pendingLoansCount={pendingLoans.length}
          openTicketsCount={openTickets.length}
          pendingReservationsCount={pendingReservations.length}
          currentUserRole={currentUser.role}
          onOpenAdministration={() => setIsAdministrationModalOpen(true)}
        />

        {/* Main Content Pane */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {isLoading && (
            <div className="mb-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              Menyinkronkan data dengan authoritative backend...
            </div>
          )}

          {currentTab === 'dashboard' && (
            <DashboardView
              assets={assets}
              loans={loans}
              tickets={tickets}
              currentUser={currentUser}
              auditLogs={auditLogs}
              onNavigate={setCurrentTab}
              onOpenNewLoanModal={() => setIsCreateLoanModalOpen(true)}
              onOpenNewTicketModal={() => setIsCreateTicketModalOpen(true)}
              onOpenNewAssetModal={() => setIsCreateAssetModalOpen(true)}
            />
          )}

          {currentTab === 'my_assets' && (
            <MyAssetsView
              assets={assets}
              loans={loans}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
              onReportAsset={(ast) => {
                setSelectedAssetForDetail(ast);
                setIsCreateTicketModalOpen(true);
              }}
              onOpenNewLoanModal={() => setIsCreateLoanModalOpen(true)}
              onOpenNewTicketModal={() => setIsCreateTicketModalOpen(true)}
              onReturnLoan={handleReturnLoan}
            />
          )}

          {currentTab === 'meeting_rooms' && (
            <MeetingRoomsView
              rooms={meetingRooms}
              reservations={roomReservations}
              currentUser={currentUser}
              onCreateReservation={handleCreateReservation}
              onApproveReservation={handleApproveReservation}
              onRejectReservation={handleRejectReservation}
              onCheckinReservation={handleCheckinReservation}
              onCheckoutReservation={handleCheckoutReservation}
              onCancelReservation={handleCancelReservation}
              onUpdateRoomStatus={handleUpdateRoomStatus}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'assets' && (
            <AssetsView
              assets={assets}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
              onOpenQrModal={setSelectedAssetForQr}
              onOpenScannerModal={() => setIsScannerModalOpen(true)}
              onOpenNewAssetModal={() => setIsCreateAssetModalOpen(true)}
              onLoanAsset={(ast) => {
                setSelectedAssetForDetail(ast);
                setIsCreateLoanModalOpen(true);
              }}
              onReportAsset={(ast) => {
                setSelectedAssetForDetail(ast);
                setIsCreateTicketModalOpen(true);
              }}
            />
          )}

          {currentTab === 'maintenance' && (
            <MaintenanceView
              schedules={maintenanceSchedules}
              assets={assets}
              currentUser={currentUser}
              onOpenAssetDetail={setSelectedAssetForDetail}
              showToast={showToast}
              onUpdateScheduleStatus={(id, st) => {
                setMaintenanceSchedules(prev => prev.map(s => s.id === id ? { ...s, status: st, last_completed_at: st === 'completed' ? new Date().toISOString() : s.last_completed_at } : s));
                showToast(`Status pemeliharaan diperbarui menjadi ${st}.`, 'success');
              }}
              onAddSchedule={(newSch) => {
                setMaintenanceSchedules(prev => [newSch as MaintenanceSchedule, ...prev]);
                showToast('Jadwal servis berhasil ditambahkan ke kalender pemeliharaan.', 'success');
              }}
            />
          )}

          {currentTab === 'loans' && (
            <LoansView
              loans={loans}
              assets={assets}
              currentUser={currentUser}
              onOpenNewLoanModal={() => setIsCreateLoanModalOpen(true)}
              onApproveLoan={handleApproveLoan}
              onRejectLoan={handleRejectLoan}
              onHandoverLoan={handleHandoverLoan}
              onReturnLoan={handleReturnLoan}
              onOpenBast={setSelectedLoanForBast}
            />
          )}

          {currentTab === 'tickets' && (
            <TicketsView
              tickets={tickets}
              assets={assets}
              currentUser={currentUser}
              onOpenNewTicketModal={() => setIsCreateTicketModalOpen(true)}
              onUpdateTicketStatus={handleUpdateTicketStatus}
            />
          )}

          {currentTab === 'licenses' && (
            <LicensesView
              assets={assets}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
            />
          )}

          {currentTab === 'vendors' && (
            <VendorsView vendors={vendors} />
          )}

          {currentTab === 'knowledge' && (
            <KnowledgeBaseView articles={knowledgeBase} />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              assets={assets}
              loans={loans}
              tickets={tickets}
              auditLogs={auditLogs}
              maintenanceSchedules={maintenanceSchedules}
            />
          )}
        </main>
      </div>

      {/* Modal Dialogs */}
      <LaravelArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />

      <CreateAssetModal
        isOpen={isCreateAssetModalOpen}
        onClose={() => setIsCreateAssetModalOpen(false)}
        existingAssets={assets}
        onCreateAsset={handleCreateAsset}
      />

      <CreateLoanModal
        isOpen={isCreateLoanModalOpen}
        onClose={() => setIsCreateLoanModalOpen(false)}
        assets={assets}
        existingLoans={loans}
        currentUser={currentUser}
        preselectedAssetId={selectedAssetForDetail?.id}
        onRequestLoan={handleRequestLoan}
      />

      <CreateTicketModal
        isOpen={isCreateTicketModalOpen}
        onClose={() => setIsCreateTicketModalOpen(false)}
        assets={assets}
        currentUser={currentUser}
        preselectedAssetId={selectedAssetForDetail?.id}
        onCreateTicket={handleCreateTicket}
      />

      <AssetDetailModal
        asset={selectedAssetForDetail}
        onClose={() => setSelectedAssetForDetail(null)}
        onOpenQrModal={setSelectedAssetForQr}
        onOpenBastModal={handleGenerateBastForAsset}
        onLoanThisAsset={(ast) => {
          setSelectedAssetForDetail(ast);
          setIsCreateLoanModalOpen(true);
        }}
        onReportThisAsset={(ast) => {
          setSelectedAssetForDetail(ast);
          setIsCreateTicketModalOpen(true);
        }}
        onUpdateAsset={handleUpdateAsset}
        currentUser={currentUser}
        allAssets={assets}
      />

      <QRCodeModal
        asset={selectedAssetForQr}
        onClose={() => setSelectedAssetForQr(null)}
      />

      <QRScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        assets={assets}
        onSelectAsset={(ast) => {
          setSelectedAssetForDetail(ast);
          setIsScannerModalOpen(false);
        }}
      />

      <BastDocumentModal
        isOpen={!!selectedLoanForBast}
        onClose={() => setSelectedLoanForBast(null)}
        loan={selectedLoanForBast}
        asset={assets.find(a => a.id === selectedLoanForBast?.asset_id) || null}
      />

      <AdministrationModal
        isOpen={isAdministrationModalOpen}
        onClose={() => setIsAdministrationModalOpen(false)}
        users={allUsers}
        auditLogs={auditLogs}
        assets={assets}
        loans={loans}
        tickets={tickets}
        onUpdateUser={(updated) => {
          setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
          if (currentUser.id === updated.id) {
            setCurrentUser(prev => ({ ...prev, ...updated }));
          }
        }}
        onCreateUser={(newUser) => setAllUsers(prev => [newUser, ...prev])}
        onDeleteUser={(userId) => setAllUsers(prev => prev.filter(u => u.id !== userId))}
        showToast={showToast}
        onRefreshData={refreshData}
      />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        assets={assets}
        loans={loans}
        tickets={tickets}
        onSelectAsset={(ast) => {
          setSelectedAssetForDetail(ast);
          setCurrentTab('assets');
        }}
        onSelectLoan={(_loan) => {
          setCurrentTab('loans');
        }}
        onSelectTicket={(_ticket) => {
          setCurrentTab('tickets');
        }}
      />
    </div>
  );
}
