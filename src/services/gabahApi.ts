import { Asset, Loan, Ticket, UserProfile, AssetMovement, AttentionItem, AuditLog, OwnerDivision, MeetingRoom, RoomReservation, MeetingTypeItem, MeetingFacilityItem, Contract, MaintenanceSchedule, Vendor, KnowledgeArticle } from '../types';

const TOKEN_STORAGE_KEY = 'gabah_auth_token';

class GabahApiClient {
  private currentUserId: string = 'USR-ADM-001';
  private authToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    }
  }

  setToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }

  /**
   * Self-service password change (P1). On success the server revokes every
   * session and re-issues a fresh token for this device, which we persist so
   * the user stays signed in on the current browser only.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile; token: string; expires_at: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    this.setToken(res.token);
    return res.user;
  }

  getToken(): string | null {
    if (!this.authToken && typeof window !== 'undefined') {
      this.authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    return this.authToken;
  }

  setActor(userId: string) {
    this.currentUserId = userId;
  }

  getActorId(): string {
    return this.currentUserId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as any),
    };

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401 && endpoint !== '/api/auth/login') {
        this.setToken(null);
      }
      const err: any = new Error(json.message || `Request gagal: ${res.statusText}`);
      err.conflict = json.conflict;
      err.can_override = json.can_override;
      throw err;
    }

    return json.data !== undefined ? json.data : json;
  }

  // Users & Auth
  async login(email: string, password: string): Promise<{ user: UserProfile; token: string; expires_at: string }> {
    const data = await this.request<{ user: UserProfile; token: string; expires_at: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data?.token) {
      this.setToken(data.token);
      this.setActor(data.user.id);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getUsers(): Promise<any[]> {
    return this.request<any[]>('/api/users');
  }

  async createUser(payload: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * IMPORT MASSAL pegawai dari file CSV/Excel.
   * Upsert per email: akun baru dibuat, akun yang sudah ada di-update profilnya
   * (tanpa menyentuh password/sesi). Response: { created, updated, failed, errors[] }.
   */
  async bulkImportUsers(users: Array<{ name: string; email: string; role?: string; division?: string; department?: string; phone?: string }>): Promise<{
    created: number;
    updated: number;
    failed: number;
    errors: string[];
    users: UserProfile[];
  }> {
    return this.request<any>('/api/users/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ users }),
    });
  }

  /**
   * IMPORT MASSAL aset dari file CSV/Excel.
   * Setiap baris divalidasi server-side (taxonomi, authority divisi, duplikat
   * SN/No. Accurate, penomoran otomatis). allowUpdate=true → baris yang SN/
   * No. Accurate-nya sudah terdaftar diperbarui, bukan ditolak.
   */
  async bulkImportAssets(
    assets: Array<{
      name: string;
      category?: string;
      owner_division?: string;
      brand?: string;
      model?: string;
      serial_number?: string;
      corporate_asset_number?: string;
      specifications?: string;
      purchase_date?: string;
      purchase_price?: string | number;
      location?: string;
      condition?: string;
      is_loanable?: string | boolean;
      notes?: string;
    }>,
    allowUpdate = false,
  ): Promise<{
    created: number;
    updated: number;
    failed: number;
    errors: string[];
    warnings: string[];
    assets: Asset[];
  }> {
    return this.request<any>('/api/assets/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ assets, allow_update: allowUpdate }),
    });
  }

  async updateUser(userId: string, payload: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(userId: string, force = true): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/users/${userId}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    });
  }

  async getMe(): Promise<any> {
    return this.request<any>('/api/auth/me');
  }

  async switchRole(target: string | { userId?: string; role?: string }): Promise<any> {
    const payload = typeof target === 'string' ? { userId: target } : target;
    const data = await this.request<any>('/api/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const token = data?.token || data?.data?.token;
    const user = data?.user || data?.data?.user;
    if (token) {
      this.setToken(token);
    }
    if (user?.id) {
      this.setActor(user.id);
    }
    return data;
  }

  // Taxonomy
  async getCategories(): Promise<any[]> {
    return this.request<any[]>('/api/taxonomy/categories');
  }

  async createCategory(payload: {
    code: string;
    name: string;
    main_type: string;
    owner_division: string;
    category_type?: string;
    description?: string;
    is_loanable_by_default?: boolean;
  }): Promise<any> {
    return this.request<any>('/api/taxonomy/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCategory(code: string, payload: {
    name?: string;
    main_type?: string;
    owner_division?: string;
    category_type?: string;
    description?: string;
    is_loanable_by_default?: boolean;
  }): Promise<any> {
    return this.request<any>(`/api/taxonomy/categories/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteCategory(code: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/taxonomy/categories/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
  }

  async resolveTaxonomy(nameOrCode: string): Promise<any> {
    return this.request<any>('/api/taxonomy/resolve', {
      method: 'POST',
      body: JSON.stringify({ nameOrCode }),
    });
  }

  // Master Locations
  async getLocations(): Promise<any[]> {
    return this.request<any[]>('/api/master/locations');
  }

  async createLocation(payload: { name: string; address?: string; capacity?: string }): Promise<any> {
    return this.request<any>('/api/master/locations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateLocation(id: string, payload: { name?: string; address?: string; capacity?: string }): Promise<any> {
    return this.request<any>(`/api/master/locations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteLocation(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/master/locations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // Master Divisions
  async getDivisions(): Promise<any[]> {
    return this.request<any[]>('/api/master/divisions');
  }

  async createDivision(payload: { code: string; name: string; leader?: string; depts?: string[] }): Promise<any> {
    return this.request<any>('/api/master/divisions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDivision(code: string, payload: { name?: string; leader?: string; depts?: string[] }): Promise<any> {
    return this.request<any>(`/api/master/divisions/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteDivision(code: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/master/divisions/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
  }

  // Assets
  async getAssets(): Promise<Asset[]> {
    return this.request<Asset[]>('/api/assets');
  }

  async getAssetById(id: string): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${id}`);
  }

  async createAsset(payload: {
    category_name_or_code: string;
    owner_division?: OwnerDivision;
    name: string;
    corporate_asset_number?: string | null;
    brand?: string;
    model?: string;
    serial_number?: string;
    specifications?: string;
    purchase_date?: string;
    purchase_price?: number;
    warranty_until?: string;
    location?: string;
    is_loanable?: boolean;
    condition?: string;
    assigned_to_user_id?: string;
    license_detail?: any;
    notes?: string;
  }): Promise<Asset> {
    return this.request<Asset>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async assignAsset(id: string, targetUserId: string, reason: string): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, reason }),
    });
  }

  async moveAsset(id: string, newLocation: string, reason: string): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ newLocation, reason }),
    });
  }

  async mutateLifecycle(id: string, action: string, notes: string): Promise<Asset> {
    return this.request<Asset>(`/api/assets/${id}/lifecycle`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  // Movements
  async getMovements(assetId?: string): Promise<AssetMovement[]> {
    const url = assetId ? `/api/movements?assetId=${assetId}` : '/api/movements';
    return this.request<AssetMovement[]>(url);
  }

  // Loans
  async getLoans(): Promise<Loan[]> {
    return this.request<Loan[]>('/api/loans');
  }

  async requestLoan(payload: {
    asset_id?: string;
    asset_ids?: string[];
    borrower_id: string;
    purpose: string;
    start_date: string;
    due_date: string;
  }): Promise<Loan> {
    return this.request<Loan>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async requestBatchLoans(payload: {
    asset_ids: string[];
    borrower_id: string;
    purpose: string;
    start_date: string;
    due_date: string;
  }): Promise<{ success: boolean; data: Loan; loans: Loan[]; count: number; message: string }> {
    return this.request<{ success: boolean; data: Loan; loans: Loan[]; count: number; message: string }>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async approveLoan(loanId: string): Promise<Loan> {
    return this.request<Loan>(`/api/loans/${loanId}/approve`, {
      method: 'POST',
    });
  }

  async rejectLoan(loanId: string, reason: string): Promise<Loan> {
    return this.request<Loan>(`/api/loans/${loanId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async handoverLoan(loanId: string, handoverNotes: string): Promise<Loan> {
    return this.request<Loan>(`/api/loans/${loanId}/handover`, {
      method: 'POST',
      body: JSON.stringify({ handoverNotes }),
    });
  }

  async returnLoan(loanId: string, condition: string, returnNotes: string): Promise<Loan> {
    return this.request<Loan>(`/api/loans/${loanId}/return`, {
      method: 'POST',
      body: JSON.stringify({ condition, returnNotes }),
    });
  }

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    return this.request<Ticket[]>('/api/tickets');
  }

  async createTicket(payload: {
    title: string;
    description: string;
    category: string;
    priority: string;
    related_asset_id?: string;
    contract_id?: string;
  }): Promise<Ticket> {
    return this.request<Ticket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTicketStatus(id: string, status: string, resolutionNotes?: string): Promise<Ticket> {
    return this.request<Ticket>(`/api/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  }

  // Notifications
  async getNotifications(): Promise<any[]> {
    return this.request<any[]>('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.request<any>(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request<any>('/api/notifications/read-all', {
      method: 'POST',
    });
  }

  // Dashboard & Attention Center
  async getDashboardStats(): Promise<any> {
    return this.request<any>('/api/dashboard/stats');
  }

  async getAttentionItems(): Promise<AttentionItem[]> {
    return this.request<AttentionItem[]>('/api/dashboard/attention');
  }

  // Accurate Reconciliation
  async getReconciliation(): Promise<{ stats: any; items: any[] }> {
    return this.request<{ stats: any; items: any[] }>('/api/reconciliation');
  }

  async linkCorporateAssetNumber(assetId: string, corporateAssetNumber: string): Promise<Asset> {
    return this.request<Asset>('/api/reconciliation/link', {
      method: 'POST',
      body: JSON.stringify({ assetId, corporateAssetNumber }),
    });
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/api/audit-logs');
  }

  /** Live asset numbering sequence snapshot (P2#10). */
  async getNumberingSequences(): Promise<Array<{ key: string; division: string; code: string; year: number; current: number }>> {
    return this.request<Array<{ key: string; division: string; code: string; year: number; current: number }>>('/api/numbering/sequences');
  }

  /** CR-05 reminder subsystem overview for the admin Notification Center (P2#11). */
  async getReminderOverview(): Promise<any> {
    return this.request<any>('/api/contracts/reminders/overview');
  }

  // Meeting Rooms & Reservations
  async getMeetingRooms(): Promise<MeetingRoom[]> {
    return this.request<MeetingRoom[]>('/api/meeting-rooms');
  }

  async getRoomReservations(query?: { room_id?: string; date?: string; status?: string; organizer_id?: string }): Promise<RoomReservation[]> {
    const params = new URLSearchParams();
    if (query?.room_id) params.append('room_id', query.room_id);
    if (query?.date) params.append('date', query.date);
    if (query?.status) params.append('status', query.status);
    if (query?.organizer_id) params.append('organizer_id', query.organizer_id);
    const qs = params.toString();
    const url = qs ? `/api/room-reservations?${qs}` : '/api/room-reservations';
    return this.request<RoomReservation[]>(url);
  }

  async createRoomReservation(payload: {
    room_id: string;
    title: string;
    description?: string;
    attendees_count: number;
    attendees_list?: string;
    meeting_type?: string;
    priority?: 'high' | 'medium' | 'low';
    date: string;
    start_time: string;
    end_time: string;
    facilities_requested?: string[];
    consumption_requested?: boolean;
    consumption_type?: string;
    consumption_pax?: number;
    consumption_serving_time?: string;
    consumption_notes?: string;
    documentation_requested?: boolean;
    documentation_type?: string;
    documentation_notes?: string;
    notes?: string;
    override_conflict?: boolean;
    interruption_reason?: string;
  }): Promise<RoomReservation> {
    return this.request<RoomReservation>('/api/room-reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async approveRoomReservation(id: string): Promise<RoomReservation> {
    return this.request<RoomReservation>(`/api/room-reservations/${id}/approve`, {
      method: 'POST',
    });
  }

  async rejectRoomReservation(id: string, reason: string): Promise<RoomReservation> {
    return this.request<RoomReservation>(`/api/room-reservations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async checkinRoomReservation(id: string): Promise<RoomReservation> {
    return this.request<RoomReservation>(`/api/room-reservations/${id}/checkin`, {
      method: 'POST',
    });
  }

  async checkoutRoomReservation(id: string): Promise<RoomReservation> {
    return this.request<RoomReservation>(`/api/room-reservations/${id}/checkout`, {
      method: 'POST',
    });
  }

  async cancelRoomReservation(id: string): Promise<RoomReservation> {
    return this.request<RoomReservation>(`/api/room-reservations/${id}/cancel`, {
      method: 'POST',
    });
  }

  async updateMeetingRoom(id: string, updates: Partial<MeetingRoom>): Promise<MeetingRoom> {
    return this.request<MeetingRoom>(`/api/meeting-rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // =========================
  // Preventive Maintenance (server-authoritative schedules)
  // =========================
  async getMaintenances(): Promise<MaintenanceSchedule[]> {
    return this.request<MaintenanceSchedule[]>('/api/maintenances');
  }

  async createMaintenance(payload: Partial<MaintenanceSchedule> & { asset_id: string }): Promise<MaintenanceSchedule> {
    return this.request<MaintenanceSchedule>('/api/maintenances', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateMaintenance(id: string, updates: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> {
    return this.request<MaintenanceSchedule>(`/api/maintenances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // =========================
  // Vendor Directory (server-authoritative)
  // =========================
  async getVendors(): Promise<Vendor[]> {
    return this.request<Vendor[]>('/api/vendors');
  }

  async createVendor(payload: Partial<Vendor> & { name: string }): Promise<Vendor> {
    return this.request<Vendor>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateVendor(id: string, updates: Partial<Vendor>): Promise<Vendor> {
    return this.request<Vendor>(`/api/vendors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // =========================
  // Knowledge Base (SOP & panduan)
  // =========================
  async getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
    return this.request<KnowledgeArticle[]>('/api/knowledge');
  }

  async createKnowledgeArticle(payload: Partial<KnowledgeArticle> & { title: string; content: string }): Promise<KnowledgeArticle> {
    return this.request<KnowledgeArticle>('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateKnowledgeArticle(id: string, updates: Partial<KnowledgeArticle>): Promise<KnowledgeArticle> {
    return this.request<KnowledgeArticle>(`/api/knowledge/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async voteKnowledgeArticle(id: string): Promise<KnowledgeArticle> {
    return this.request<KnowledgeArticle>(`/api/knowledge/${id}/vote`, { method: 'POST' });
  }

  async viewKnowledgeArticle(id: string): Promise<KnowledgeArticle> {
    return this.request<KnowledgeArticle>(`/api/knowledge/${id}/view`, { method: 'POST' });
  }

  // =========================
  // Contract Management (separate domain — NOT helpdesk)
  // =========================
  async getContracts(): Promise<Contract[]> {
    return this.request<Contract[]>('/api/contracts');
  }

  async getContractById(id: string): Promise<Contract> {
    return this.request<Contract>(`/api/contracts/${id}`);
  }

  async createContract(payload: {
    contract_type: string;
    title: string;
    vendor_name: string;
    owner_division: string;
    pic_user_id: string;
    start_date: string;
    end_date: string;
    notice_period_days?: number;
    contract_value?: number;
    auto_renewal?: boolean;
    restricted?: boolean;
    escalation_user_id?: string | null;
    notes?: string;
    status?: 'draft' | 'active';
    reminder_config?: { reminder1_days: number; reminder2_days: number; reminder3_days: number };
  }): Promise<Contract> {
    return this.request<Contract>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateContract(id: string, updates: Partial<Contract>): Promise<Contract> {
    return this.request<Contract>(`/api/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async addContractDocument(id: string, doc: { kind: string; file_name: string; file_ref: string }): Promise<Contract> {
    return this.request<Contract>(`/api/contracts/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  }

  async addContractMilestone(id: string, milestone: { type: string; title: string; due_date: string; amount?: number; notes?: string }): Promise<Contract> {
    return this.request<Contract>(`/api/contracts/${id}/milestones`, {
      method: 'POST',
      body: JSON.stringify(milestone),
    });
  }

  async decideContractRenewal(id: string, outcome: string, notes: string, replacementContractId?: string | null): Promise<Contract> {
    return this.request<Contract>(`/api/contracts/${id}/renewal-decision`, {
      method: 'POST',
      body: JSON.stringify({ outcome, notes, replacement_contract_id: replacementContractId || null }),
    });
  }

  async runContractReminderSweep(): Promise<{ evaluated: number; queued: number; logs: any[] }> {
    return this.request<{ evaluated: number; queued: number; logs: any[] }>('/api/contracts/reminders/run', {
      method: 'POST',
    });
  }

  async getContractNotificationLogs(id: string): Promise<any[]> {
    return this.request<any[]>(`/api/contracts/${id}/notification-logs`);
  }

  // Meeting Types CRUD API
  async getMeetingTypes(): Promise<MeetingTypeItem[]> {
    return this.request<MeetingTypeItem[]>('/api/meeting-types');
  }

  async createMeetingType(payload: Partial<MeetingTypeItem>): Promise<MeetingTypeItem> {
    return this.request<MeetingTypeItem>('/api/meeting-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateMeetingType(id: string, payload: Partial<MeetingTypeItem>): Promise<MeetingTypeItem> {
    return this.request<MeetingTypeItem>(`/api/meeting-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteMeetingType(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/meeting-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Meeting Facilities CRUD API
  async getMeetingFacilities(): Promise<MeetingFacilityItem[]> {
    return this.request<MeetingFacilityItem[]>('/api/meeting-facilities');
  }

  async createMeetingFacility(payload: Partial<MeetingFacilityItem>): Promise<MeetingFacilityItem> {
    return this.request<MeetingFacilityItem>('/api/meeting-facilities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateMeetingFacility(id: string, payload: Partial<MeetingFacilityItem>): Promise<MeetingFacilityItem> {
    return this.request<MeetingFacilityItem>(`/api/meeting-facilities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteMeetingFacility(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/meeting-facilities/${id}`, {
      method: 'DELETE',
    });
  }
}

export const gabahApi = new GabahApiClient();
