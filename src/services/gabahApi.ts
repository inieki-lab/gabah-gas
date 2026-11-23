import { Asset, Loan, Ticket, TicketComment, UserProfile, AssetMovement, AttentionItem, AuditLog, OwnerDivision, MeetingRoom, RoomReservation, MeetingTypeItem, MeetingFacilityItem, Contract, MaintenanceSchedule, Vendor, KnowledgeArticle } from '../types';

export interface AssetNumberingRule {
  id: string;
  owner_division: string;
  asset_code: string;
  separator: string;
  sequence_digits: number;
  is_active: boolean;
  notes: string;
  usage_count: number;
  sequence_current?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ModuleLifecycleRecord {
  module_key: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  updated_at?: string;
}

export interface ModuleStatusAuditRecord {
  id: number;
  module_key: string;
  previous_is_active: boolean;
  new_is_active: boolean;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
}

class GabahApiClient {
  private currentUserId: string = 'USR-ADM-001';

  /** Self-service password change rotates the HttpOnly session cookie. */
  async changePassword(currentPassword: string, newPassword: string): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile; expires_at: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return res.user;
  }

  setActor(userId: string) {
    this.currentUserId = userId;
  }

  getActorId(): string {
    return this.currentUserId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as any),
    };

    const res = await fetch(endpoint, {
      ...options,
      credentials: 'same-origin',
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const err: any = new Error(json.message || `Request gagal: ${res.statusText}`);
      err.conflict = json.conflict;
      err.can_override = json.can_override;
      throw err;
    }

    return json.data !== undefined ? json.data : json;
  }

  // Users & Auth
  async login(email: string, password: string): Promise<{ user: UserProfile; expires_at: string }> {
    const data = await this.request<{ user: UserProfile; expires_at: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setActor(data.user.id);
    return data;
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }

  async getUsers(): Promise<any[]> {
    return this.request<any[]>('/api/users');
  }

  async getModules(): Promise<ModuleLifecycleRecord[]> {
    return this.request<ModuleLifecycleRecord[]>('/api/modules');
  }

  async updateModuleStatus(moduleKey: string, payload: { is_active: boolean; reason: string }): Promise<ModuleLifecycleRecord> {
    return this.request<ModuleLifecycleRecord>('/api/modules/' + encodeURIComponent(moduleKey), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getModuleAudit(moduleKey: string): Promise<ModuleStatusAuditRecord[]> {
    return this.request<ModuleStatusAuditRecord[]>('/api/modules/' + encodeURIComponent(moduleKey) + '/audit');
  }

  async getNotificationRuleSettings(): Promise<Array<{ rule_id: string; is_active: boolean; updated_at: string; updated_by_user_id: string | null }>> {
    return this.request('/api/admin/notification-rules');
  }

  async updateNotificationRuleSetting(ruleId: string, isActive: boolean): Promise<{ rule_id: string; is_active: boolean; updated_at: string; updated_by_user_id: string | null }> {
    return this.request('/api/admin/notification-rules/' + encodeURIComponent(ruleId), {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  async getSystemSettings(): Promise<{ companyName: string; accountingStandard: string; baseCurrency: string; fiscalYear: string; updated_at?: string; updated_by_user_id?: string | null }> {
    return this.request('/api/admin/system-settings');
  }

  async updateSystemSettings(payload: { companyName: string; accountingStandard: string; baseCurrency: string; fiscalYear: string }): Promise<{ companyName: string; accountingStandard: string; baseCurrency: string; fiscalYear: string; updated_at?: string; updated_by_user_id?: string | null }> {
    return this.request('/api/admin/system-settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
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
  async bulkImportUsers(users: Array<{ name: string; email: string; role?: string; division?: string; department?: string; phone?: string; job_level_code?: string; unit_id?: string; office_location_id?: string }>): Promise<{
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

    const user = data?.user || data?.data?.user;
    if (user?.id) {
      this.setActor(user.id);
    }
    return data;
  }

  // Taxonomy
  async getCategories(): Promise<any[]> {
    return this.request<any[]>('/api/taxonomy/categories');
  }

  /** Server-calculated asset creation choices; fails closed when owner scope cannot be resolved. */
  async getAssetCreateOptions(): Promise<{ owner_domains: Array<{ code: string; name: string }>; categories: any[] }> {
    return this.request<{ owner_domains: Array<{ code: string; name: string }>; categories: any[] }>('/api/assets/create-options');
  }

  async createCategory(payload: {
    code: string;
    name: string;
    main_type: string;
    owner_division: string;
    category_type?: string;
    description?: string;
    is_loanable_by_default?: boolean;
    /** T2B-3: status aktif master; default true (nonaktif = tidak dapat dipilih untuk aset baru). */
    is_active?: boolean;
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
    /** T2B-3: toggle enable/disable kategori (disable, bukan hapus permanen). */
    is_active?: boolean;
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

  // =========================
  // ORG-MODEL: master Jabatan/Level, Unit, Kantor/Lokasi (terpisah & configurable).
  // Jabatan TIDAK memberikan permission — RBAC tetap per role.
  // =========================
  async getJobLevels(): Promise<any[]> {
    return this.request<any[]>('/api/master/job-levels');
  }

  async createJobLevel(payload: { code: string; label: string; order?: number }): Promise<any> {
    return this.request<any>('/api/master/job-levels', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateJobLevel(code: string, payload: { label?: string; order?: number; is_active?: boolean }): Promise<any> {
    return this.request<any>(`/api/master/job-levels/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async getOrgUnits(): Promise<any[]> {
    return this.request<any[]>('/api/master/org-units');
  }

  async createOrgUnit(payload: { name: string; division_code: string }): Promise<any> {
    return this.request<any>('/api/master/org-units', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateOrgUnit(id: string, payload: { name?: string; division_code?: string; is_active?: boolean }): Promise<any> {
    return this.request<any>(`/api/master/org-units/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async getOfficeLocations(): Promise<any[]> {
    return this.request<any[]>('/api/master/office-locations');
  }

  async createOfficeLocation(payload: { name: string }): Promise<any> {
    return this.request<any>('/api/master/office-locations', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateOfficeLocation(id: string, payload: { name?: string; is_active?: boolean }): Promise<any> {
    return this.request<any>(`/api/master/office-locations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  // T2B-2: master Lokasi Fisik Aset — terpisah dari lokasi kantor user.
  async getAssetLocations(): Promise<any[]> {
    return this.request<any[]>('/api/master/asset-locations');
  }

  async createAssetLocation(payload: { name: string; parent_id?: string | null }): Promise<any> {
    return this.request<any>('/api/master/asset-locations', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateAssetLocation(id: string, payload: { name?: string; parent_id?: string | null; is_active?: boolean }): Promise<any> {
    return this.request<any>(`/api/master/asset-locations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
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
    /** T2B-2: relasi lokasi fisik aset (asset_locations.id). */
    asset_location_id?: string | null;
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

  async getTicketAssignees(ticketId: string): Promise<Array<{ id: string; name: string; department: string }>> {
    return this.request<Array<{ id: string; name: string; department: string }>>(`/api/tickets/${encodeURIComponent(ticketId)}/assignees`);
  }

  async updateTicketAssignment(ticketId: string, assignedAgentId: string | null): Promise<Ticket> {
    return this.request<Ticket>(`/api/tickets/${encodeURIComponent(ticketId)}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_agent_id: assignedAgentId }),
    });
  }

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return this.request<TicketComment[]>(`/api/tickets/${encodeURIComponent(ticketId)}/comments`);
  }

  async addTicketComment(ticketId: string, body: string): Promise<TicketComment> {
    return this.request<TicketComment>(`/api/tickets/${encodeURIComponent(ticketId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
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

  /** Server-persisted numbering rule catalog (Superadmin only). */
  async getNumberingRules(): Promise<AssetNumberingRule[]> {
    return this.request<AssetNumberingRule[]>('/api/numbering/rules');
  }

  async createNumberingRule(payload: Pick<AssetNumberingRule, 'owner_division' | 'asset_code' | 'separator' | 'sequence_digits' | 'notes'>): Promise<AssetNumberingRule> {
    return this.request<AssetNumberingRule>('/api/numbering/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateNumberingRule(id: string, payload: Partial<Pick<AssetNumberingRule, 'separator' | 'sequence_digits' | 'is_active' | 'notes'>>): Promise<AssetNumberingRule> {
    return this.request<AssetNumberingRule>(`/api/numbering/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteNumberingRule(id: string, payload: { confirmation_code: string; reason: string }): Promise<{ id: string; deleted: boolean }> {
    return this.request<{ id: string; deleted: boolean }>(`/api/numbering/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
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

  async uploadContractDocument(id: string, file: File): Promise<{ document_id: string; file_name: string; file_size: number; file_mime: string }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/contracts/${id}/documents/upload`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const error: any = new Error(json.message || `Upload dokumen gagal: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return json.data;
  }

  async downloadContractDocument(id: string, documentId: string): Promise<Blob> {
    const res = await fetch(`/api/contracts/${id}/documents/${documentId}/download`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const error: any = new Error(json.message || `Download dokumen gagal: ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    return res.blob();
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

  // Dynamic RBAC administration — all writes are enforced by the server.
  async getRbacRoles(): Promise<any[]> {
    return this.request<any[]>('/api/admin/rbac/roles');
  }

  async getRbacUserAssignments(): Promise<any[]> {
    return this.request<any[]>('/api/admin/rbac/user-assignments');
  }

  async setRbacUserRoles(userId: string, role_ids: number[]): Promise<any> {
    return this.request<any>('/api/admin/rbac/users/' + encodeURIComponent(userId) + '/roles', {
      method: 'PUT',
      body: JSON.stringify({ role_ids }),
    });
  }

  async getRbacPermissions(): Promise<any[]> {
    return this.request<any[]>('/api/admin/rbac/permissions');
  }

  async createRbacRole(payload: { name: string; description?: string; permission_keys?: string[] }): Promise<any> {
    return this.request<any>('/api/admin/rbac/roles', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateRbacRole(id: number, payload: { name?: string; description?: string; is_active?: boolean }): Promise<any> {
    return this.request<any>('/api/admin/rbac/roles/' + id, { method: 'PATCH', body: JSON.stringify(payload) });
  }

  async deleteRbacRole(id: number): Promise<any> {
    return this.request<any>('/api/admin/rbac/roles/' + id, { method: 'DELETE' });
  }

  async setRbacRolePermissions(id: number, permission_keys: string[]): Promise<any> {
    return this.request<any>('/api/admin/rbac/roles/' + id + '/permissions', { method: 'PUT', body: JSON.stringify({ permission_keys }) });
  }

  async setRbacRoleScopes(id: number, scopes: Array<{ type: 'all' | 'own' | 'division' | 'unit' | 'location'; value?: string | null }>): Promise<any> {
    return this.request<any>('/api/admin/rbac/roles/' + id + '/scopes', { method: 'PUT', body: JSON.stringify({ scopes }) });
  }

}

export const gabahApi = new GabahApiClient();
