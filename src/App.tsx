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
  UserRole,
  Contract
} from './types';
import { INITIAL_VENDORS, INITIAL_KNOWLEDGE_BASE, INITIAL_USERS, INITIAL_MAINTENANCE_SCHEDULES } from './data/mockData';
import { gabahApi } from './services/gabahApi';
import { GabahService } from './services/gabahService';

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
import { ContractsView } from './components/views/ContractsView';
import { CreateContractModal } from './components/modals/CreateContractModal';
import { MyAssetsView } from './components/views/MyAssetsView';
import { MeetingRoomsView } from './components/views/MeetingRoomsView';

import { CreateAssetModal } from './components/modals/CreateAssetModal';
import { CreateLoanModal } from './components/modals/CreateLoanModal';
import { CreateTicketModal } from './components/modals/CreateTicketModal';
import { AssetDetailModal } from './components/modals/AssetDetailModal';
import { QRCodeModal } from './components/modals/QRCodeModal';
import { QRScannerModal } from './components/modals/QRScannerModal';
import { BastDocumentModal } from './components/modals/BastDocumentModal';
import { AdministrationModal } from './components/modals/AdministrationModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { EditAssetModal } from './components/modals/EditAssetModal';
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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isCreateContractModalOpen, setIsCreateContractModalOpen] = useState(false);
  const [contractForLinkedTicket, setContractForLinkedTicket] = useState<Contract | null>(null);

  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [meetingCategoryFilter, setMeetingCategoryFilter] = useState<'all' | 'consumption' | 'documentation' | 'it_facilities' | 'ga_facilities' | 'high_priority'>('all');
  // Default to 'portal' to show working application immediately
  const [viewMode, setViewMode] = useState<'landing' | 'login' | 'portal'>('portal');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals state
  const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
  const [isCreateLoanModalOpen, setIsCreateLoanModalOpen] = useState(false);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);
  const [preselectedTicketAssetId, setPreselectedTicketAssetId] = useState<string | undefined>(undefined);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [linkedTicketContractId, setLinkedTicketContractId] = useState<string | undefined>(undefined);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<Asset | null>(null);
  const [selectedAssetForQr, setSelectedAssetForQr] = useState<Asset | null>(null);
  const [selectedLoanForBast, setSelectedLoanForBast] = useState<Loan | null>(null);
  const [isAdministrationModalOpen, setIsAdministrationModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  const handleOpenNewTicketModal = () => {
    setPreselectedTicketAssetId(undefined);
    setIsCreateTicketModalOpen(true);
  };

  const handleReportAssetTicket = (ast: Asset) => {
    setPreselectedTicketAssetId(ast.id);
    setIsCreateTicketModalOpen(true);
  };

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
      const [fetchedAssets, fetchedLoans, fetchedTickets, fetchedLogs, fetchedUsers, fetchedRooms, fetchedReservations, fetchedContracts] = await Promise.all([
        gabahApi.getAssets().catch(() => []),
        gabahApi.getLoans().catch(() => []),
        gabahApi.getTickets().catch(() => []),
        gabahApi.getAuditLogs().catch(() => []),
        gabahApi.getUsers().catch(() => INITIAL_USERS),
        gabahApi.getMeetingRooms().catch(() => []),
        gabahApi.getRoomReservations().catch(() => []),
        gabahApi.getContracts().catch(() => []),
      ]);

      if (Array.isArray(fetchedAssets)) setAssets(fetchedAssets);
      if (Array.isArray(fetchedLoans)) setLoans(fetchedLoans);
      if (Array.isArray(fetchedTickets)) setTickets(fetchedTickets);
      if (Array.isArray(fetchedLogs)) setAuditLogs(fetchedLogs);
      if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) setAllUsers(fetchedUsers);
      if (Array.isArray(fetchedRooms)) setMeetingRooms(fetchedRooms);
      if (Array.isArray(fetchedReservations)) setRoomReservations(fetchedReservations);
      if (Array.isArray(fetchedContracts)) setContracts(fetchedContracts);
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
          }
          // SECURITY (CR-02): no automatic login with hardcoded credentials.
          // An invalid/expired token simply clears the session; the user must
          // authenticate explicitly via the Login page.
        }
        // No token: stay signed out until the user logs in with real
        // credentials (server-side verification only).
      } catch (err) {
        console.warn('Auth initialization:', err);
      } finally {
        await refreshData();
      }
    }
    initAuth();
  }, [refreshData]);

  // Handle Role Switch (SECURITY CR-01: identity changes ONLY when the server
  // confirms the switch and returns a fresh session token; no local fallback
  // that would simulate a role change the server refused.)
  const handleSelectUser = async (user: UserProfile) => {
    try {
      const res = await gabahApi.switchRole(user.id);
      const targetUser = res?.user || res?.data?.user;
      if (!targetUser) {
        showToast('Alih peran ditolak oleh server.', 'warning');
        return;
      }
      setCurrentUser(targetUser);
      showToast(`Berpindah akun aktif: ${targetUser.name} (${targetUser.role_label || targetUser.role})`, 'info');
      await refreshData();
    } catch (err: any) {
      showToast(err?.message || 'Alih peran ditolak oleh server.', 'warning');
    }
  };

  const handleSwitchRoleSimulation = async (role: UserRole) => {
    try {
      const res = await gabahApi.switchRole({ role });
      const targetUser = res?.user || res?.data?.user;
      if (!targetUser) {
        showToast('Alih peran ditolak oleh server.', 'warning');
        return;
      }
      setCurrentUser(targetUser);
      showToast(`Beralih peran: ${targetUser.name} (${targetUser.role_label || targetUser.role})`, 'info');
      await refreshData();
    } catch (err: any) {
      showToast(err?.message || 'Alih peran ditolak oleh server.', 'warning');
    }
  };

  // Guard Humas: Sesuai instruksi user, Humas tidak perlu bisa melihat aset
  useEffect(() => {
    if (currentUser.role === 'Humas' && (currentTab === 'my_assets' || currentTab === 'assets')) {
      setCurrentTab('meeting_rooms');
    }
  }, [currentUser.role, currentTab]);

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

  // 3. Request Loan (Atomic Backend Schedule Collision Detection & Multi-Asset Support)
  const handleRequestLoan = async (data: {
    asset_id?: string;
    asset_ids?: string[];
    purpose: string;
    start_date: string;
    due_date: string;
    borrower_phone: string;
  }) => {
    try {
      if (data.asset_ids && data.asset_ids.length > 1) {
        const res = await gabahApi.requestBatchLoans({
          asset_ids: data.asset_ids,
          borrower_id: currentUser.id,
          purpose: data.purpose,
          start_date: data.start_date,
          due_date: data.due_date,
        });
        showToast(`${res.count || data.asset_ids.length} Permohonan pinjaman berhasil diajukan! Tiket diteruskan independen ke divisi terkait (IT/GA).`);
      } else {
        const targetAssetId = data.asset_ids?.[0] || data.asset_id || '';
        const newLoan = await gabahApi.requestLoan({
          asset_id: targetAssetId,
          borrower_id: currentUser.id,
          purpose: data.purpose,
          start_date: data.start_date,
          due_date: data.due_date,
        });
        showToast(`Reservasi ${newLoan.loan_number} (${newLoan.asset_name}) berhasil diajukan! Menunggu persetujuan.`);
      }

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
      const rejected = await gabahApi.rejectLoan(loanId, reason);
      showToast(`Reservasi ${rejected.loan_number} ditolak. Peminjam telah diberi notifikasi.`, 'info');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menolak peminjaman', 'warning');
      await refreshData();
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
    const existingLoan = (loans || []).find(l => l.asset_id === ast.id && (l.status === 'active' || l.status === 'approved' || l.status === 'returned'));
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
        contract_id: linkedTicketContractId,
      });

      showToast(`Tiket ${newTicket.ticket_number} berhasil dibuat! Target SLA: ${newTicket.sla_hours} jam.`);
      setIsCreateTicketModalOpen(false);
      setPreselectedTicketAssetId(undefined);
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

  // 10b. Contract Management (separate domain)
  const handleCreateContract = async (payload: any) => {
    const created = await gabahApi.createContract(payload);
    showToast(`Kontrak ${created.contract_number} berhasil didaftarkan.`);
    await refreshData();
    return created;
  };

  const handleCreateLinkedTicket = (contract: Contract) => {
    setContractForLinkedTicket(contract);
    setLinkedTicketContractId(contract.id);
    setPreselectedTicketAssetId(undefined);
    setIsCreateTicketModalOpen(true);
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
  const visibleTickets = tickets.filter(t => GabahService.isTicketVisibleToUser(t, currentUser));
  const urgentTickets = visibleTickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');
  const openTickets = visibleTickets.filter(t => t.status === 'open' || t.status === 'in_progress');
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
            setCurrentUser(u);
            setViewMode('portal');
            showToast(`Berhasil masuk sebagai ${u.name} (${u.role_label || u.role})`, 'success');
            refreshData();
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
        onOpenScannerModal={() => setIsScannerModalOpen(true)}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
        onLogout={async () => {
          await gabahApi.logout();
          setViewMode('login');
          showToast('Sesi selesai, berhasil logout.', 'info');
        }}
        pendingLoans={pendingLoans}
        urgentTickets={urgentTickets}
        roomReservations={roomReservations}
        onNavigateToLoans={() => setCurrentTab('loans')}
        onNavigateToTickets={() => setCurrentTab('tickets')}
        onNavigateToMeetingRooms={(category) => {
          if (category) {
            setMeetingCategoryFilter(category);
          }
          setCurrentTab('meeting_rooms');
        }}
      />

      {/* App Shell: Sidebar + Main Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            if (tab === 'meeting_rooms') {
              setMeetingCategoryFilter('all');
            }
            setCurrentTab(tab);
          }}
          pendingLoansCount={pendingLoans.length}
          openTicketsCount={openTickets.length}
          pendingReservationsCount={pendingReservations.length}
          documentationRequestsCount={roomReservations.filter(r => r.documentation_requested && !['cancelled', 'rejected'].includes(r.status)).length}
          itFacilitiesCount={roomReservations.filter(r => !['cancelled', 'rejected'].includes(r.status) && GabahService.getITFacilities(r).length > 0).length}
          gaRequestsCount={roomReservations.filter(r => !['cancelled', 'rejected'].includes(r.status) && (
            GabahService.getGAFacilities(r).length > 0 ||
            r.consumption_requested ||
            r.status === 'pending_approval'
          )).length}
          currentUserRole={currentUser.role}
          onOpenAdministration={() => {
            if (currentUser.role === 'Admin GABAH') {
              setIsAdministrationModalOpen(true);
            }
          }}
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
              roomReservations={roomReservations}
              onNavigate={setCurrentTab}
              onOpenNewLoanModal={() => setIsCreateLoanModalOpen(true)}
              onOpenNewTicketModal={handleOpenNewTicketModal}
              onOpenNewAssetModal={() => setIsCreateAssetModalOpen(true)}
            />
          )}

          {currentTab === 'my_assets' && (
            <MyAssetsView
              assets={assets}
              loans={loans}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
              onReportAsset={handleReportAssetTicket}
              onOpenNewLoanModal={() => setIsCreateLoanModalOpen(true)}
              onOpenNewTicketModal={handleOpenNewTicketModal}
              onReturnLoan={(loanId) => handleReturnLoan(loanId, 'good', 'Diajukan pengembalian oleh peminjam via Portal Aset Saya')}
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
              initialCategoryFilter={meetingCategoryFilter}
            />
          )}

          {currentTab === 'assets' && (
            <AssetsView
              assets={assets}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
              onEditAsset={setSelectedAssetForEdit}
              onOpenQrModal={setSelectedAssetForQr}
              onOpenScannerModal={() => setIsScannerModalOpen(true)}
              onOpenNewAssetModal={() => setIsCreateAssetModalOpen(true)}
              onLoanAsset={(ast) => {
                setSelectedAssetForDetail(ast);
                setIsCreateLoanModalOpen(true);
              }}
              onReportAsset={handleReportAssetTicket}
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
              onOpenNewTicketModal={handleOpenNewTicketModal}
              onUpdateTicketStatus={handleUpdateTicketStatus}
            />
          )}

          {currentTab === 'licenses' && (
            <LicensesView
              assets={assets}
              currentUser={currentUser}
              onSelectAsset={setSelectedAssetForDetail}
              onOpenNewAssetModal={() => setIsCreateAssetModalOpen(true)}
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

          {currentTab === 'contracts' && (
            <ContractsView
              contracts={contracts}
              currentUser={currentUser}
              onRefresh={refreshData}
              showToast={showToast}
              onCreateContract={() => setIsCreateContractModalOpen(true)}
              onCreateLinkedTicket={handleCreateLinkedTicket}
            />
          )}
        </main>
      </div>

      {/* Modal Dialogs */}
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
        onClose={() => {
          setIsCreateTicketModalOpen(false);
          setPreselectedTicketAssetId(undefined);
          setContractForLinkedTicket(null);
          setLinkedTicketContractId(undefined);
        }}
        assets={assets}
        loans={loans}
        currentUser={currentUser}
        preselectedAssetId={preselectedTicketAssetId}
        linkedContract={contractForLinkedTicket}
        onCreateTicket={handleCreateTicket}
      />

      <CreateContractModal
        isOpen={isCreateContractModalOpen}
        onClose={() => setIsCreateContractModalOpen(false)}
        users={allUsers}
        currentUser={currentUser}
        onCreate={handleCreateContract}
      />

      <AssetDetailModal
        asset={selectedAssetForDetail}
        onClose={() => setSelectedAssetForDetail(null)}
        onOpenQrModal={setSelectedAssetForQr}
        onOpenBastModal={handleGenerateBastForAsset}
        assetLoans={(loans || []).filter(l => l.asset_id === selectedAssetForDetail?.id)}
        assetTickets={(tickets || []).filter(t => t.related_asset_id === selectedAssetForDetail?.id)}
        onEditThisAsset={(ast) => {
          setSelectedAssetForEdit(ast);
        }}
        onLoanThisAsset={(ast) => {
          setSelectedAssetForDetail(ast);
          setIsCreateLoanModalOpen(true);
        }}
        onReportThisAsset={(ast) => {
          handleReportAssetTicket(ast);
        }}
        onUpdateAsset={handleUpdateAsset}
        currentUser={currentUser}
        allAssets={assets}
      />

      <EditAssetModal
        asset={selectedAssetForEdit}
        isOpen={!!selectedAssetForEdit}
        onClose={() => setSelectedAssetForEdit(null)}
        currentUser={currentUser}
        allUsers={allUsers}
        allAssets={assets}
        onSaveAsset={async (assetId, updates, assignUserId, assignReason) => {
          try {
            if (updates && Object.keys(updates).length > 0) {
              await gabahApi.updateAsset(assetId, updates);
            }
            if (assignUserId !== undefined) {
              await gabahApi.assignAsset(assetId, assignUserId, assignReason || 'Penugasan aset karyawan');
            }
            await refreshData();
            showToast(assignUserId ? 'Aset berhasil ditugaskan ke pegawai!' : 'Perubahan aset berhasil disimpan!');
            if (selectedAssetForDetail?.id === assetId) {
              const all = await gabahApi.getAssets();
              const updated = all.find(a => a.id === assetId);
              if (updated) setSelectedAssetForDetail(updated);
            }
          } catch (err: any) {
            showToast(`Gagal menyimpan: ${err.message}`, 'warning');
            throw err;
          }
        }}
        onSaved={async (saved) => {
          if (selectedAssetForDetail?.id === saved.id) {
            setSelectedAssetForDetail(saved);
          }
          await refreshData();
          showToast(`Aset ${saved.asset_number} berhasil diperbarui & disimpan!`);
        }}
        onOpenBastModal={(asset) => {
          handleGenerateBastForAsset(asset);
        }}
        users={allUsers}
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
        asset={(assets || []).find(a => a.id === selectedLoanForBast?.asset_id) || null}
      />

      <AdministrationModal
        isOpen={isAdministrationModalOpen && currentUser?.role === 'Admin GABAH'}
        onClose={() => setIsAdministrationModalOpen(false)}
        users={allUsers}
        auditLogs={auditLogs}
        assets={assets}
        loans={loans}
        tickets={tickets}
        currentUser={currentUser}
        activeRole={currentUser.role}
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
        tickets={visibleTickets}
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
