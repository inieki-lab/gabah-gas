export type AssetCategoryType = 'IT' | 'GA' | 'License' | 'General';

export type AssetStatus =
  | 'active'
  | 'assigned'
  | 'available'
  | 'reserved'
  | 'in_repair'
  | 'damaged'
  | 'cannibalized'
  | 'pending_disposal'
  | 'pending_auction'
  | 'auctioned'
  | 'disposed'
  | 'lost'
  | 'inactive'
  | 'in_use'
  | 'loaned'
  | 'maintenance';

export type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'broken' | 'excellent' | 'damaged';

export type OwnerDivision = 'IT' | 'GA' | 'SC' | 'PIBC' | 'Audit' | 'Umum' | string;

export interface LicenseDetail {
  license_key?: string;
  total_seats: number;
  used_seats: number;
  billing_cycle: 'monthly' | 'yearly' | 'perpetual';
  expiration_date: string;
  renewal_cost: number; // IDR
  vendor_id?: string;
  vendor?: string;
  renewal_period?: string;
  seats_total?: number;
  seats_allocated?: number;
}

export interface AssetMovement {
  id: string;
  asset_id: string;
  asset_number: string;
  from_user_name?: string | null;
  to_user_name?: string | null;
  from_location: string;
  to_location: string;
  reason: string;
  document_ref?: string;
  performed_by_name: string;
  created_at: string;
}

export interface AttentionItem {
  id: string;
  type: 'sla_breach' | 'sla_warning' | 'loan_pending' | 'loan_overdue' | 'warranty_expiring' | 'unmatched_reconciliation';
  title: string;
  description: string;
  severity: 'critical' | 'action_required' | 'warning';
  link_type: 'ticket' | 'loan' | 'asset' | 'reconciliation';
  link_id: string;
}

export interface Asset {
  id: string;
  asset_number: string; // The ONLY authoritative human-readable asset number: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
  corporate_asset_number: string | null; // Accurate ERP number (Optional / Manual input)
  owner_division: OwnerDivision;
  owner_division_id?: number;
  /** T2B-1: unit operasional pengelola aset — relasi ke org_units.id (nullable). */
  managing_unit_id?: string | null;
  asset_category_id?: string | number;
  category_code?: string; // e.g. HLT, HPC, HSV, INV-F, MSN
  asset_code?: string;
  name: string;
  category_type: AssetCategoryType;
  subcategory?: string;
  brand: string;
  model: string;
  serial_number: string;
  hostname?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  specifications: string;
  purchase_date: string;
  purchase_price: number;
  price?: number;
  warranty_until: string;
  warranty_expiry?: string;
  status: AssetStatus;
  condition: AssetCondition;
  location: string;
  location_id?: number;
  assigned_to?: {
    id: string;
    name: string;
    department: string;
    email?: string;
    assigned_date?: string;
  } | null;
  vendor_id?: string;
  pic_id?: string | null;
  custom_attributes?: Record<string, any>;
  qr_code_url?: string;
  is_loanable: boolean;
  loan_blocked?: boolean;
  loan_blocked_reason?: string | null;
  license_detail?: LicenseDetail;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'returned' | 'overdue';

export interface Loan {
  id: string;
  loan_number: string; // e.g. LOAN-2026-0001
  asset_id: string;
  asset_name: string;
  asset_number: string; // Official authoritative asset number
  corporate_asset_number: string | null;
  category_type: AssetCategoryType;
  owner_division?: string;
  borrower_id: string;
  borrower_name: string;
  borrower_department: string;
  borrower_phone: string;
  purpose: string;
  loan_date?: string;
  start_date: string; // YYYY-MM-DDTHH:mm
  due_date: string;   // YYYY-MM-DDTHH:mm (Official due date)
  status: LoanStatus;
  approver_name?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  handover_by?: string;
  received_by?: string;
  handover_at?: string;
  actual_returned_at?: string;
  returned_at?: string;
  return_condition?: AssetCondition;
  return_notes?: string;
  notes?: string;
  created_at: string;
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'pending_vendor' | 'resolved' | 'closed';
/**
 * Helpdesk Ticket Category — strictly divisional.
 * Contract Management is a separate domain and is NOT a ticket category.
 * Software/License/SaaS tickets belong to 'IT' (License is an asset domain, not a helpdesk category).
 */
export type TicketCategory = 'IT' | 'GA' | 'SC' | 'PIBC';

export interface Ticket {
  id: string;
  ticket_number: string; // e.g. TKT-2026-0001
  ticket_code?: string; // Compatibility alias
  title: string;
  subject?: string;
  type?: string; // incident, request, maintenance
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  reporter_id: string;
  reporter_name: string;
  reporter_department: string;
  related_asset_id?: string;
  related_asset_name?: string;
  related_asset_number?: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  sla_hours: number; // e.g. Urgent: 4h, High: 8h, Medium: 24h, Low: 48h
  sla_response_deadline?: string;
  sla_resolution_deadline?: string;
  due_date?: string;
  is_over_sla?: boolean;
  approval_status?: string;
  approved_by?: string;
  approved_at?: string;
  resolved_at?: string;
  resolution_notes?: string;
  rating?: number; // 1-5
  created_at: string;
  updated_at: string;
}

export type MaintenanceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'one_time';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface MaintenanceSchedule {
  id: string;
  schedule_code: string; // e.g. MNT-2026-001
  title: string;
  asset_id: string;
  asset_name: string;
  asset_number: string;
  category_type: AssetCategoryType;
  owner_division: OwnerDivision;
  scheduled_date: string; // YYYY-MM-DD
  frequency: MaintenanceFrequency;
  status: MaintenanceStatus;
  technician_name: string;
  vendor_id?: string;
  vendor_name?: string;
  estimated_cost?: number;
  actual_cost?: number;
  notes: string;
  last_completed_at?: string;
  checklist?: string[];
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: AssetCategoryType; // Vendor service domain (License = asset domain, NOT a ticket category)
  pic_name: string;
  pic_phone: string;
  pic_email: string;
  address: string;
  active_contracts_count: number;
  rating: number; // 1.0 - 5.0
  notes: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: AssetCategoryType | 'Policy';
  content: string;
  tags: string[];
  view_count: number;
  helpful_votes: number;
  author: string;
  updated_at: string;
}

export type UserRole =
  | 'Admin GABAH'
  | 'IT'
  | 'GA'
  | 'Sekretaris Direksi'
  | 'Humas'
  | 'Supply Chain'
  | 'PIBC'
  | 'Karyawan'
  | 'Auditor';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  role_label: string;
  division?: OwnerDivision;
  department: string;
  /** ORG-MODEL: atribut organisasi independen — jabatan TIDAK memberikan permission,
   *  unit ≠ role, lokasi penempatan ≠ unit. */
  job_level_code?: string;
  unit_id?: string | null;
  office_location_id?: string | null;
  avatar: string;
  // SECURITY (CR-02): temp_password removed from the client model — plaintext
  // credentials are never sent to or stored by the frontend.
  phone?: string;
  is_active?: boolean;
  /** Telegram chat id untuk pengiriman reminder (admin-managed via PATCH /api/users/:id). */
  telegram_chat_id?: string;
}

export interface Notice {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  auditable_type?: string;
  auditable_id?: string | number;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string;
  user_agent?: string;
  user_name: string;
  role: UserRole;
  module: 'Assets' | 'Loans' | 'Tickets' | 'Licenses' | 'Vendors' | 'Auth' | 'MeetingRooms';
  details: string;
  timestamp: string;
}

export type RoomStatus = 'available' | 'in_use' | 'maintenance';

/**
 * CONTRACT MANAGEMENT — separate business domain (NOT a helpdesk category).
 * Contract = business record; Notification = reminder; Ticket = linked work/action.
 */
export type ContractStatus = 'draft' | 'active' | 'expiring' | 'renewal_in_progress' | 'renewed' | 'terminated' | 'expired';
export type RenewalOutcome = 'pending_decision' | 'renewed' | 'not_renewed' | 'terminated' | 'replaced_by_new_contract';
export type ContractDocumentKind = 'original_contract' | 'amendment' | 'renewal' | 'supporting_document';
export type ContractMilestoneType = 'payment' | 'service_maintenance' | 'evaluation' | 'other_obligation';

export interface ContractReminderConfig {
  reminder1_days: number;
  reminder2_days: number;
  reminder3_days: number;
}

export interface ContractDocument {
  id: string;
  kind: ContractDocumentKind;
  file_name: string;
  file_ref: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ContractMilestone {
  id: string;
  type: ContractMilestoneType;
  title: string;
  due_date: string;
  amount?: number;
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  notes?: string;
}

export interface ContractNotificationLog {
  id: string;
  contract_id: string;
  notification_type: string;
  channel: 'in_app' | 'email' | 'telegram';
  recipient: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error_message?: string | null;
}

export interface Contract {
  id: string;
  contract_number: string;
  contract_type: string;
  title: string;
  vendor_name: string;
  owner_division: string;
  owner_division_label?: string;
  pic_user_id: string;
  pic_name: string;
  start_date: string;
  end_date: string;
  notice_period_days: number;
  notice_date: string;
  contract_value: number;
  auto_renewal: boolean;
  status: ContractStatus;
  renewal_outcome: RenewalOutcome;
  renewal_notes?: string | null;
  replaced_by_contract_id?: string | null;
  parent_contract_id?: string | null;
  documents: ContractDocument[];
  milestones: ContractMilestone[];
  reminder_config: ContractReminderConfig;
  escalation_user_id?: string | null;
  restricted: boolean;
  notes?: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingRoom {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  status: RoomStatus;
  color: string;
  description: string;
  pic_ga: string;
  image_url?: string;
}

export type ReservationStatus = 'pending_approval' | 'approved' | 'rejected' | 'in_use' | 'completed' | 'cancelled';
export type MeetingType = string;
export type MeetingPriority = 'high' | 'medium' | 'low';

export interface MeetingTypeItem {
  id: string;
  name: string;
  code: string;
  description: string;
  priority_level: MeetingPriority;
  color: string;
  is_system?: boolean;
}

export interface MeetingFacilityItem {
  id: string;
  name: string;
  category: 'GA' | 'IT';
  description?: string;
  is_active: boolean;
  is_system?: boolean;
}

export interface RoomReservation {
  id: string;
  reservation_number: string; // e.g. RSV-2026-0001
  room_id: string;
  room_name: string;
  room_code?: string;
  room_location: string;
  title: string; // Agenda / Subject
  description?: string;
  organizer_id: string;
  organizer_name: string;
  organizer_department: string;
  organizer_phone: string;
  organizer_role?: string;
  attendees_count: number;
  attendees_list?: string; // Multiline or comma-separated list of attendees
  meeting_type: string;
  priority: MeetingPriority;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  start_datetime: string; // ISO string
  end_datetime: string; // ISO string
  facilities_requested: string[];
  consumption_requested: boolean;
  consumption_type?: 'snack_box' | 'lunch_box' | 'coffee_tea' | 'vip_buffet' | 'custom';
  consumption_pax?: number;
  consumption_serving_time?: string;
  consumption_notes?: string;
  documentation_requested?: boolean;
  documentation_type?: 'foto' | 'video' | 'press_release' | 'notulensi' | 'lengkap';
  documentation_notes?: string;
  status: ReservationStatus;
  approver_id?: string | null;
  approver_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  is_interrupted?: boolean;
  interrupted_by_name?: string;
  interruption_reason?: string;
  original_room_name?: string;
  checkin_at?: string | null;
  checkout_at?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}
