import { CANONICAL_TAXONOMY } from './taxonomy';
import { AssetNumberingEngine } from './numbering';
import { hashPassword } from './crypto';

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin GABAH' | 'IT' | 'GA' | 'Supply Chain' | 'PIBC' | 'Karyawan' | 'Auditor' | 'Sekretaris Direksi' | 'Humas';
  role_label?: string;
  division: 'IT' | 'GA' | 'SC' | 'PIBC' | 'Audit' | 'Umum';
  department: string;
  phone?: string;
  avatar: string;
  is_active: boolean;
  password_hash?: string;
  password_salt?: string;
  temp_password?: string;
}

export interface ServerSession {
  id: string;
  token: string;
  user_id: string;
  original_admin_id?: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  ip_address?: string;
  user_agent?: string;
  simulated_user?: ServerUser;
}

export interface ServerAsset {
  id: string;
  asset_number: string;
  corporate_asset_number: string | null; // Accurate ERP
  name: string;
  category_code: string;
  category_type: 'IT' | 'General' | 'License';
  owner_division: 'IT' | 'GA' | 'SC' | 'PIBC';
  brand: string;
  model: string;
  serial_number: string;
  specifications: string;
  purchase_date: string;
  purchase_price: number;
  warranty_until: string;
  status: 'active' | 'assigned' | 'available' | 'reserved' | 'in_repair' | 'damaged' | 'cannibalized' | 'pending_disposal' | 'pending_auction' | 'auctioned' | 'disposed' | 'lost' | 'inactive';
  condition: 'new' | 'good' | 'fair' | 'poor' | 'broken';
  location: string;
  is_loanable: boolean;
  assigned_to?: {
    id: string;
    name: string;
    email: string;
    department: string;
    assigned_date: string;
  } | null;
  license_detail?: {
    license_key: string;
    seats_total: number;
    seats_allocated: number;
    vendor: string;
    renewal_period: string;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServerAssetMovement {
  id: string;
  asset_id: string;
  asset_number: string;
  from_user_id?: string | null;
  from_user_name?: string | null;
  to_user_id?: string | null;
  to_user_name?: string | null;
  from_location: string;
  to_location: string;
  reason: string;
  document_ref?: string;
  performed_by_id: string;
  performed_by_name: string;
  created_at: string;
}

export interface ServerLoan {
  id: string;
  loan_number: string;
  asset_id: string;
  asset_name: string;
  asset_number: string;
  owner_division: 'IT' | 'GA' | 'SC' | 'PIBC';
  borrower_id: string;
  borrower_name: string;
  borrower_department: string;
  borrower_phone: string;
  purpose: string;
  start_date: string;
  due_date: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'borrowed' | 'returned' | 'overdue' | 'closed';
  approver_id?: string | null;
  approver_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  handover_notes?: string | null;
  handover_by_id?: string | null;
  handover_at?: string | null;
  actual_returned_at?: string | null;
  return_condition?: string | null;
  return_inspected_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServerTicket {
  id: string;
  ticket_number: string;
  ticket_code: string;
  title: string;
  description: string;
  category: 'IT' | 'GA' | 'SC' | 'PIBC' | 'License' | 'General';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'assigned' | 'in_progress' | 'pending_user' | 'resolved' | 'closed';
  reporter_id: string;
  reporter_name: string;
  reporter_department: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  related_asset_id?: string;
  related_asset_name?: string;
  related_asset_number?: string;
  sla_hours: number;
  sla_resolution_deadline: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServerNotification {
  id: string;
  recipient_role?: string;
  recipient_division?: string;
  recipient_user_id?: string;
  title: string;
  message: string;
  severity: 'critical' | 'action_required' | 'warning' | 'info' | 'success';
  category: 'sla' | 'warranty' | 'loan' | 'movement' | 'disposal' | 'contract' | 'reconciliation' | 'system';
  link_type?: 'asset' | 'loan' | 'ticket' | 'reconciliation';
  link_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface ServerAuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id?: string;
  user_name: string;
  user_role: string;
  details: string;
  ip_address?: string;
  timestamp: string;
}

export interface ServerMaintenance {
  id: string;
  schedule_code: string;
  title: string;
  asset_id: string;
  asset_name: string;
  asset_number: string;
  category_type: string;
  owner_division: string;
  scheduled_date: string;
  frequency: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  technician_name: string;
  vendor_id?: string;
  vendor_name?: string;
  estimated_cost?: number;
  actual_cost?: number;
  notes: string;
  checklist?: string[];
  last_completed_at?: string;
  created_at: string;
}

export interface ServerMeetingRoom {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: string;
  capacity: number;
  facilities: string[];
  status: 'available' | 'in_use' | 'maintenance';
  color: string;
  description: string;
  pic_ga: string;
  image_url?: string;
}

export interface ServerMeetingType {
  id: string;
  name: string;
  code: string;
  description: string;
  priority_level: 'high' | 'medium' | 'low';
  color: string;
  is_system?: boolean;
}

export interface ServerMeetingFacility {
  id: string;
  name: string;
  category: 'GA' | 'IT';
  description?: string;
  is_active: boolean;
  is_system?: boolean;
}

export interface ServerRoomReservation {
  id: string;
  reservation_number: string;
  room_id: string;
  room_name: string;
  room_code?: string;
  room_location: string;
  title: string;
  description?: string;
  organizer_id: string;
  organizer_name: string;
  organizer_department: string;
  organizer_phone: string;
  organizer_role?: string;
  attendees_count: number;
  attendees_list?: string;
  meeting_type: string;
  priority: 'high' | 'medium' | 'low';
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  start_datetime: string;
  end_datetime: string;
  facilities_requested: string[];
  consumption_requested: boolean;
  consumption_type?: 'snack_box' | 'lunch_box' | 'coffee_tea' | 'vip_buffet' | 'custom';
  consumption_pax?: number;
  consumption_serving_time?: string;
  consumption_notes?: string;
  documentation_requested?: boolean;
  documentation_type?: 'foto' | 'video' | 'press_release' | 'notulensi' | 'lengkap';
  documentation_notes?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'in_use' | 'completed' | 'cancelled';
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

// In-Memory Authoritative Data Store
export const db = {
  users: [] as ServerUser[],
  sessions: [] as ServerSession[],
  assets: [] as ServerAsset[],
  categories: [...CANONICAL_TAXONOMY] as any[],
  locations: [
    { id: 'loc-1', name: 'Kantor Pusat Food Station Cipinang', address: 'Jl. Pisangan Lama No. 1, Jakarta Timur', capacity: '120 Pegawai' },
    { id: 'loc-2', name: 'Gudang Beras Induk Blok A-D', address: 'Kawasan PIBC, Jakarta Timur', capacity: '48.000 Ton Beras' },
    { id: 'loc-3', name: 'Depo Armada & Transportasi', address: 'Pintu 3 Pasar Induk Cipinang', capacity: '35 Truk Fuso' },
    { id: 'loc-4', name: 'Data Center & Server Room', address: 'Gedung Utama Lt. 2, Cipinang', capacity: 'Tier 2 Redundant' }
  ] as any[],
  divisions: [
    { code: 'SC', name: 'Supply Chain & Logistik', leader: 'Direktur Operasional', depts: ['Pergudangan Beras Induk', 'Armada Truk & Distribusi', 'Kualitas & Pengemasan'] },
    { code: 'PIBC', name: 'Pasar Induk Beras Cipinang', leader: 'Kepala Pasar Induk', depts: ['Pengelolaan Kios & Los', 'Ketertiban & Retribusi', 'Informasi Pasokan Beras'] },
    { code: 'IT', name: 'Teknologi Informasi & Sistem', leader: 'Manajer IT & Transformasi Digital', depts: ['Infrastruktur & Jaringan', 'Sistem ERP SAP & GABAH', 'Technical Support & Helpdesk'] },
    { code: 'GA', name: 'General Affairs & Fasilitas', leader: 'Manajer Umum', depts: ['Pemeliharaan Gedung & ME', 'Kendaraan Operasional Kantor', 'Keamanan & Kebersihan'] },
  ] as any[],
  movements: [] as ServerAssetMovement[],
  loans: [] as ServerLoan[],
  tickets: [] as ServerTicket[],
  notifications: [] as ServerNotification[],
  auditLogs: [] as ServerAuditLog[],
  maintenances: [] as ServerMaintenance[],
  rooms: [] as ServerMeetingRoom[],
  roomReservations: [] as ServerRoomReservation[],
  meetingTypes: [] as ServerMeetingType[],
  meetingFacilities: [] as ServerMeetingFacility[],
};

// Seed Enterprise Master Users
export function seedInitialData() {
  const defaultUsers: Array<Omit<ServerUser, 'password_hash' | 'password_salt'> & { initialPassword: string }> = [
    {
      id: 'USR-01',
      name: 'Budi Santoso',
      email: 'admin@foodstation.co.id',
      role: 'Admin GABAH',
      division: 'IT',
      department: 'Management Information System & TI',
      phone: '081234567890',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'AdminGabah#2026',
    },
    {
      id: 'USR-02',
      name: 'Siti Rahmawati',
      email: 'ga@foodstation.co.id',
      role: 'GA',
      division: 'GA',
      department: 'General Affairs & Rumah Tangga',
      phone: '081398765432',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'GaFoodStation#2026',
    },
    {
      id: 'USR-SEKDIR',
      name: 'Dewi Anggraini, S.Sos',
      email: 'sekretariat.direksi@foodstation.co.id',
      role: 'Sekretaris Direksi',
      division: 'GA',
      department: 'Sekretariat Direksi & Dewan Komisaris',
      phone: '081288997766',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'DireksiFoodStation#2026',
    },
    {
      id: 'USR-HUMAS',
      name: 'Rina Kartika, M.I.Kom',
      email: 'humas@foodstation.co.id',
      role: 'Humas',
      division: 'GA',
      department: 'Humas & Protokoler Perusahaan',
      phone: '081377889900',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'HumasFoodStation#2026',
    },
    {
      id: 'USR-03',
      name: 'Dani Setiawan',
      email: 'it.support@foodstation.co.id',
      role: 'IT',
      division: 'IT',
      department: 'Management Information System & TI',
      phone: '081233445566',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'ItFoodStation#2026',
    },
    {
      id: 'USR-04',
      name: 'Hendra Wijaya',
      email: 'hendra.w@foodstation.co.id',
      role: 'Karyawan',
      division: 'SC',
      department: 'Divisi Perdagangan & Komersial',
      phone: '081299887766',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'Karyawan#2026',
    },
  ];

  db.users = defaultUsers.map(({ initialPassword, ...user }) => {
    const { hash, salt } = hashPassword(initialPassword);
    return {
      ...user,
      password_hash: hash,
      password_salt: salt,
    };
  });

  // Seed Canonical Assets (IT, GA, SC)
  db.assets = [
    {
      id: 'AST-HLT-001',
      asset_number: 'IT-HLT-2026-0001',
      corporate_asset_number: 'FST-24-0012',
      name: 'ThinkPad T14 Gen 4 Core i7 32GB',
      category_code: 'HLT',
      category_type: 'IT',
      owner_division: 'IT',
      brand: 'Lenovo',
      model: 'ThinkPad T14 Gen 4',
      serial_number: 'PF-4X89K2',
      specifications: 'Intel Core i7-1365U, 32GB DDR5, 1TB NVMe, Windows 11 Pro',
      purchase_date: '2024-02-15',
      purchase_price: 24500000,
      warranty_until: '2027-02-15',
      status: 'available',
      condition: 'good',
      location: 'Head Office - Lt. 2 Ruang IT',
      is_loanable: true,
      assigned_to: null,
      created_at: '2024-02-15T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'AST-HLT-002',
      asset_number: 'IT-HLT-2026-0002',
      corporate_asset_number: 'FST-24-0013',
      name: 'MacBook Air M2 16GB 512GB (Pool Pinjaman)',
      category_code: 'HLT',
      category_type: 'IT',
      owner_division: 'IT',
      brand: 'Apple',
      model: 'MacBook Air 13-inch M2',
      serial_number: 'C02G89A2Q05D',
      specifications: 'Apple M2 8-core CPU, 10-core GPU, 16GB Unified RAM, 512GB SSD',
      purchase_date: '2024-04-10',
      purchase_price: 21900000,
      warranty_until: '2026-04-10',
      status: 'available',
      condition: 'good',
      location: 'Head Office - Gudang IT Pool',
      is_loanable: true,
      assigned_to: null,
      created_at: '2024-04-10T09:00:00Z',
      updated_at: '2026-09-01T09:00:00Z',
    },
    {
      id: 'AST-HPC-001',
      asset_number: 'IT-HPC-2026-0001',
      corporate_asset_number: 'FST-24-0044',
      name: 'Dell OptiPlex 7000 Tower Akuntansi',
      category_code: 'HPC',
      category_type: 'IT',
      owner_division: 'IT',
      brand: 'Dell',
      model: 'OptiPlex 7000 MT',
      serial_number: 'DL-7000-8812',
      specifications: 'Intel Core i5-12500, 16GB RAM, 512GB SSD + 1TB HDD, Dual Monitor',
      purchase_date: '2023-08-11',
      purchase_price: 16800000,
      warranty_until: '2026-08-11',
      status: 'available',
      condition: 'good',
      location: 'Head Office - Ruang Keuangan',
      is_loanable: false,
      assigned_to: null,
      created_at: '2023-08-11T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'AST-HSV-001',
      asset_number: 'IT-HSV-2026-0001',
      corporate_asset_number: 'FST-23-0001',
      name: 'Dell PowerEdge R750 Enterprise Server',
      category_code: 'HSV',
      category_type: 'IT',
      owner_division: 'IT',
      brand: 'Dell EMC',
      model: 'PowerEdge R750 2U',
      serial_number: 'SRV-DL-R750-X1',
      specifications: 'Dual Intel Xeon Silver 4314, 128GB ECC DDR4, 4x 1.92TB Enterprise NVMe SSD',
      purchase_date: '2023-01-10',
      purchase_price: 185000000,
      warranty_until: '2028-01-10',
      status: 'active',
      condition: 'good',
      location: 'Head Office - Server Room Datacenter Lt. 2',
      is_loanable: false,
      assigned_to: null,
      created_at: '2023-01-10T11:00:00Z',
      updated_at: '2026-09-01T11:00:00Z',
    },
    {
      id: 'AST-INVF-001',
      asset_number: 'GA-INV-F-2026-0001',
      corporate_asset_number: 'FST-23-0102',
      name: 'Meja Kerja Modular 4-Pax Direksi',
      category_code: 'INV-F',
      category_type: 'General',
      owner_division: 'GA',
      brand: 'HighPoint',
      model: 'Executive Matrix 4-Pod',
      serial_number: 'HP-EX-0021',
      specifications: 'Kayu Mahoni Laminasi HPL, Partisi Kaca Akrilik, Cable Management Duct',
      purchase_date: '2023-03-20',
      purchase_price: 14500000,
      warranty_until: '2025-03-20',
      status: 'active',
      condition: 'good',
      location: 'Head Office - Ruang Direksi',
      is_loanable: false,
      assigned_to: null,
      created_at: '2023-03-20T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'AST-INVF-002',
      asset_number: 'GA-INV-F-2026-0002',
      corporate_asset_number: null, // Unmatched Accurate Example
      name: 'Kursi Ergonomis Kerja Staff PIBC',
      category_code: 'INV-F',
      category_type: 'General',
      owner_division: 'GA', // MUST REMAIN GA EVEN IN PIBC
      brand: 'Ergotec',
      model: 'Ergotec 801 Mesh',
      serial_number: 'ET-801-9923',
      specifications: 'Mesh breathable, adjustable lumbar support, 3D armrest',
      purchase_date: '2024-06-15',
      purchase_price: 2400000,
      warranty_until: '2026-06-15',
      status: 'available',
      condition: 'good',
      location: 'Pasar Induk Beras Cipinang - Kantor Pos 1',
      is_loanable: false,
      assigned_to: null,
      created_at: '2024-06-15T09:00:00Z',
      updated_at: '2026-09-01T09:00:00Z',
    },
    {
      id: 'AST-KDR-001',
      asset_number: 'GA-KDR-2026-0001',
      corporate_asset_number: 'FST-23-0310',
      name: 'Toyota Avanza 1.5 G MT Operasional',
      category_code: 'KDR',
      category_type: 'General',
      owner_division: 'GA',
      brand: 'Toyota',
      model: 'Avanza 1.5 G MT',
      serial_number: 'B-1284-FST',
      specifications: 'Mesin 1500cc Bensin, 7-Seater, AC Double Blower, GPS Tracker Aktif',
      purchase_date: '2023-05-18',
      purchase_price: 255000000,
      warranty_until: '2026-05-18',
      status: 'available',
      condition: 'good',
      location: 'Head Office - Parkir Kendaraan Dinas',
      is_loanable: true,
      assigned_to: null,
      created_at: '2023-05-18T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'AST-MSN-001',
      asset_number: 'SC-MSN-2026-0001',
      corporate_asset_number: 'FST-22-0901',
      name: 'Toyota 8FBN25 Electric Forklift 2.5 Ton',
      category_code: 'MSN',
      category_type: 'General',
      owner_division: 'SC',
      brand: 'Toyota Material Handling',
      model: '8FBN25 Counterbalanced Forklift',
      serial_number: 'TY-FL-8FBN-004',
      specifications: 'Kapasitas angkat 2500 kg, Max mast height 4.5m, Baterai 48V 565Ah',
      purchase_date: '2022-11-04',
      purchase_price: 385000000,
      warranty_until: '2025-11-04',
      status: 'active',
      condition: 'good',
      location: 'Gudang Beras Cipinang - Warehouse A',
      is_loanable: false,
      assigned_to: null,
      created_at: '2022-11-04T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'AST-SLIC-001',
      asset_number: 'IT-SLIC-2026-0001',
      corporate_asset_number: 'FST-24-LIC01',
      name: 'Microsoft 365 Business Standard (50 Seats)',
      category_code: 'SLIC',
      category_type: 'License',
      owner_division: 'IT',
      brand: 'Microsoft Corporation',
      model: 'M365 Business Standard Annual',
      serial_number: 'MS-365-FST-2024',
      specifications: 'Word, Excel, Outlook, Teams, OneDrive 1TB per user, SharePoint',
      purchase_date: '2024-01-01',
      purchase_price: 114000000,
      warranty_until: '2026-09-25', // Expiring in 14 days! Triggers Attention Center
      status: 'active',
      condition: 'good',
      location: 'Cloud Tenant Microsoft Azure',
      is_loanable: false,
      license_detail: {
        license_key: 'MS365-XXXX-YYYY-ZZZZ',
        seats_total: 50,
        seats_allocated: 48,
        vendor: 'PT Mitranet Integra Partner',
        renewal_period: 'Tahunan (Exp: 25 Sep 2026)',
      },
      created_at: '2024-01-01T08:00:00Z',
      updated_at: '2026-09-01T08:00:00Z',
    },
  ];

  // Seed Loans
  db.loans = [
    {
      id: 'LOAN-001',
      loan_number: 'LOAN-2026-0001',
      asset_id: 'AST-HLT-002',
      asset_name: 'MacBook Air M2 16GB 512GB (Pool Pinjaman)',
      asset_number: 'IT-HLT-2026-0002',
      owner_division: 'IT',
      borrower_id: 'USR-01',
      borrower_name: 'Budi Santoso',
      borrower_department: 'Management Information System & TI',
      borrower_phone: '081234567890',
      purpose: 'Presentasi Laporan Keuangan ke Badan Pengawas BUMD DKI Jakarta',
      start_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      due_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      status: 'borrowed',
      approver_id: 'USR-01',
      approver_name: 'Budi Santoso',
      approved_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      handover_by_id: 'USR-01',
      handover_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      handover_notes: 'Unit diserahkan lengkap dengan charger MagSafe dan sleeve case hitam.',
      created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'LOAN-002',
      loan_number: 'LOAN-2026-0002',
      asset_id: 'AST-KDR-001',
      asset_name: 'Toyota Avanza 1.5 G MT Operasional',
      asset_number: 'GA-KDR-2026-0001',
      owner_division: 'GA',
      borrower_id: 'USR-01',
      borrower_name: 'Budi Santoso',
      borrower_department: 'Management Information System & TI',
      borrower_phone: '081234567890',
      purpose: 'Kunjungan Lapangan Pengecekan Suplai Beras ke Distributor Karawang',
      start_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      due_date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Seed Tickets
  db.tickets = [
    {
      id: 'TKT-001',
      ticket_number: 'TKT-2026-0001',
      ticket_code: 'TKT-2026-0001',
      title: 'Koneksi ERP Accurate Terputus di Ruang Keuangan',
      description: 'Aplikasi Accurate Desktop tidak dapat terhubung ke server database. Error: Network timeout.',
      category: 'IT',
      priority: 'urgent', // 4 hours SLA -> Triggers SLA Attention!
      status: 'in_progress',
      reporter_id: 'USR-01',
      reporter_name: 'Budi Santoso',
      reporter_department: 'Management Information System & TI',
      assigned_agent_id: 'USR-01',
      assigned_agent_name: 'Budi Santoso',
      related_asset_id: 'AST-HPC-001',
      related_asset_name: 'Dell OptiPlex 7000 Tower Akuntansi',
      related_asset_number: 'IT-HPC-2026-0001',
      sla_hours: 4,
      sla_resolution_deadline: new Date(Date.now() + 1.5 * 3600 * 1000).toISOString(), // Approaching SLA breach!
      created_at: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'TKT-002',
      ticket_number: 'TKT-2026-0002',
      ticket_code: 'TKT-2026-0002',
      title: 'AC Ruang Server Lt. 2 Suhu Meningkat ke 26°C',
      description: 'Sensor suhu datacenter mendeteksi peningkatan suhu. Butuh inspeksi maintenance chiller GA segera.',
      category: 'GA',
      priority: 'high',
      status: 'open',
      reporter_id: 'USR-01',
      reporter_name: 'Budi Santoso',
      reporter_department: 'Management Information System & TI',
      assigned_agent_id: 'USR-01',
      assigned_agent_name: 'Budi Santoso',
      related_asset_id: 'AST-HSV-001',
      related_asset_name: 'Dell PowerEdge R750 Enterprise Server',
      related_asset_number: 'IT-HSV-2026-0001',
      sla_hours: 8,
      sla_resolution_deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Seed Notifications
  db.notifications = [
    {
      id: 'NOTIF-001',
      recipient_role: 'IT',
      recipient_division: 'IT',
      title: 'SLA Mendekati Batas: TKT-2026-0001',
      message: 'Tiket prioritas Urgent "Koneksi ERP Accurate Terputus" tersisa 1.5 jam sebelum SLA breach.',
      severity: 'critical',
      category: 'sla',
      link_type: 'ticket',
      link_id: 'TKT-001',
      is_read: false,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'NOTIF-002',
      recipient_role: 'GA',
      recipient_division: 'GA',
      title: 'Permohonan Peminjaman Aset: LOAN-2026-0002',
      message: 'Bambang Sudarsono mengajukan permohonan pinjam kendaraan dinas B-1284-FST untuk 24 jam ke depan.',
      severity: 'action_required',
      category: 'loan',
      link_type: 'loan',
      link_id: 'LOAN-002',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'NOTIF-003',
      recipient_role: 'IT',
      recipient_division: 'IT',
      title: 'Lisensi Akan Kedaluwarsa: Microsoft 365',
      message: 'Lisensi enterprise IT-SLIC-2026-0001 berakhir dalam 14 hari (25 Sep 2026). Perlu perpanjangan PO.',
      severity: 'warning',
      category: 'warranty',
      link_type: 'asset',
      link_id: 'AST-SLIC-001',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'NOTIF-HUMAS-001',
      recipient_role: 'Humas',
      recipient_division: 'GA',
      title: 'Permintaan Liputan & Dokumentasi Foto: Ruang Setra Wangi',
      message: 'Permintaan peliputan foto resmi untuk agenda Rapat Pleno Direksi & Dewan Komisaris pada Ruang Setra Wangi oleh Dewi Anggraini (Sekretariat Direksi).',
      severity: 'action_required',
      category: 'system',
      link_type: 'asset',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'NOTIF-HUMAS-002',
      recipient_role: 'Humas',
      recipient_division: 'GA',
      title: 'Permintaan Foto Dokumentasi: Ruang Rapat Kantor Pasar',
      message: 'Permintaan foto dokumentasi kegiatan koordinasi pasokan masuk truk beras PIBC oleh Hendra Wijaya (Divisi Komersial).',
      severity: 'action_required',
      category: 'system',
      link_type: 'asset',
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ];

  // Seed Audit Logs
  db.auditLogs = [
    {
      id: 'LOG-001',
      action: 'SYSTEM_BOOT',
      entity: 'Platform',
      user_name: 'System Core',
      user_role: 'System',
      details: 'GABAH Enterprise Engine booted with canonical taxonomy and authoritative numbering.',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'LOG-002',
      action: 'LOAN_APPROVED',
      entity: 'Loans',
      entity_id: 'LOAN-001',
      user_name: 'Budi Santoso, S.Kom.',
      user_role: 'IT',
      details: 'Menyetujui peminjaman LOAN-2026-0001 aset IT-HLT-2026-0002 untuk Citra Dewi (Keuangan).',
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
  ];

  // Seed Maintenance & Calibration Schedules
  db.maintenances = [
    {
      id: 'mnt-001',
      schedule_code: 'MNT-2026-001',
      title: 'Servis Berkala & Ganti Oli Toyota Avanza Veloz (B 1290 PQU)',
      asset_id: 'asset-007',
      asset_name: 'Toyota Avanza 1.5 Veloz MT 2023',
      asset_number: 'GA-VOP-2026-0001',
      category_type: 'GA',
      owner_division: 'GA',
      scheduled_date: '2026-09-20',
      frequency: 'quarterly',
      status: 'scheduled',
      technician_name: 'Bengkel Resmi Auto2000 Cempaka Putih',
      vendor_id: 'VND-03',
      vendor_name: 'Auto2000 Cempaka Putih (Astra Motor)',
      estimated_cost: 1750000,
      notes: 'Servis rutin 30.000 KM: Ganti oli mesin, cek kampas rem, tune up dan balancing ban depan.',
      checklist: ['Ganti Oli Mesin TMO Full Synthetic', 'Pemeriksaan Kampas Rem Depan & Belakang', 'Rotasi & Balancing Ban', 'Pemeriksaan Aki & Kelistrikan'],
      created_at: '2026-09-01T08:00:00Z',
    },
    {
      id: 'mnt-002',
      schedule_code: 'MNT-2026-002',
      title: 'Cuci & Overhaul AC Presisi Ruang Server Data Center Lt. 2',
      asset_id: 'asset-005',
      asset_name: 'Dell PowerEdge R750 Enterprise Rack Server',
      asset_number: 'IT-HSV-2026-0001',
      category_type: 'IT',
      owner_division: 'IT',
      scheduled_date: '2026-09-25',
      frequency: 'monthly',
      status: 'scheduled',
      technician_name: 'PT Cooltech Solusindo',
      vendor_id: 'VND-04',
      vendor_name: 'PT Cooltech Solusindo HVAC',
      estimated_cost: 2400000,
      notes: 'Pembersihan kondensor AC split duct server room, pengecekan freon R410A dan kalibrasi sensor temperatur otomatis.',
      checklist: ['Pembersihan Filter & Evaporator', 'Pengukuran Tekanan Freon R410A', 'Pengecekan Kompresor & Arus Listrik (Ampere)', 'Uji Otomatisasi Thermostat Dual-Cooling'],
      created_at: '2026-09-05T09:00:00Z',
    },
    {
      id: 'mnt-003',
      schedule_code: 'MNT-2026-003',
      title: 'Kalibrasi Berkala Timbangan Truk Beras 60 Ton Gudang Cipinang',
      asset_id: 'asset-010',
      asset_name: 'Jembatan Timbang Truk Tronton Avery Weigh-Tronix 60 Ton',
      asset_number: 'SC-WGH-2026-0001',
      category_type: 'General',
      owner_division: 'SC',
      scheduled_date: '2026-10-05',
      frequency: 'biannual',
      status: 'scheduled',
      technician_name: 'Balai Metrologi DKI Jakarta & Teknisi Avery',
      vendor_id: 'VND-05',
      vendor_name: 'PT Avery Weigh-Tronix Indonesia',
      estimated_cost: 6500000,
      notes: 'Uji tera resmi tahunan jembatan timbang penerimaan gabah & beras operasi 24 jam di gerbang utama PIBC.',
      checklist: ['Pemeriksaan Load Cell 4 Titik', 'Pengujian Beban Standar Uji Metrologi', 'Pembersihan Celah Kolong Jembatan dari Debu Gabah', 'Penerbitan Sertifikat Tera Sah Metrologi'],
      created_at: '2026-08-15T11:00:00Z',
    },
  ];

  // Seed Corporate Meeting Rooms (7 Official Meeting Rooms as requested)
  db.rooms = [
    {
      id: 'ROOM-01',
      name: 'Setrawangi',
      code: 'RR-SW',
      building: 'HO',
      floor: 'Lantai 2',
      capacity: 50,
      facilities: ['Sound', 'Zoom', 'Projector'],
      status: 'available',
      color: 'emerald',
      description: 'Ruang rapat Setrawangi HO Lantai 2 kapasitas 50 orang dengan Sound, Zoom, dan Projector.',
      pic_ga: 'Siti Rahmawati (GA)',
      image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-02',
      name: 'Jasmine',
      code: 'RR-JAS',
      building: 'HO',
      floor: 'Lantai 2',
      capacity: 10,
      facilities: ['Projector', 'Bisa pinjam TV'],
      status: 'available',
      color: 'teal',
      description: 'Ruang rapat Jasmine HO Lantai 2 kapasitas 10 orang dengan Projector dan opsi pinjam TV.',
      pic_ga: 'Budi Hartono (GA)',
      image_url: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-03',
      name: 'Setra Ramos',
      code: 'RR-SR',
      building: 'HO',
      floor: 'Lantai 2',
      capacity: 7,
      facilities: ['Bisa pinjam TV', 'Projector'],
      status: 'available',
      color: 'blue',
      description: 'Ruang rapat Setra Ramos HO Lantai 2 kapasitas 7 orang dilengkapi opsi pinjam TV dan Projector.',
      pic_ga: 'Siti Rahmawati (GA)',
      image_url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-04',
      name: 'Setra Pulen',
      code: 'RR-SP',
      building: 'HO',
      floor: 'Lantai 2',
      capacity: 7,
      facilities: ['Bisa pinjam TV', 'Projector'],
      status: 'available',
      color: 'amber',
      description: 'Ruang rapat Setra Pulen HO Lantai 2 kapasitas 7 orang dilengkapi opsi pinjam TV dan Projector.',
      pic_ga: 'Budi Hartono (GA)',
      image_url: 'https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-05',
      name: 'Ruang Rapat Kantor Pasar',
      code: 'RR-KP',
      building: 'Kantor Pasar',
      floor: 'Lantai 2',
      capacity: 10,
      facilities: ['Bisa pinjam TV', 'Projector'],
      status: 'available',
      color: 'rose',
      description: 'Ruang Rapat Kantor Pasar Lantai 2 kapasitas 10 orang dilengkapi opsi pinjam TV dan Projector.',
      pic_ga: 'Agus Setiawan (PIBC)',
      image_url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-06',
      name: 'Ruang Rapat RPC',
      code: 'RR-RPC',
      building: 'RPC',
      floor: 'Lantai 2',
      capacity: 15,
      facilities: ['Bisa pinjam TV', 'Projector'],
      status: 'available',
      color: 'orange',
      description: 'Ruang Rapat RPC Lantai 2 kapasitas 15 orang dilengkapi opsi pinjam TV dan Projector.',
      pic_ga: 'Budi Hartono (GA)',
      image_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'ROOM-07',
      name: 'Aula Serbaguna Pangsub',
      code: 'RR-PANGSUB',
      building: 'Gerai Pangsub',
      floor: 'Lantai 2',
      capacity: 100,
      facilities: ['Bisa pinjam TV', 'Projector', 'Sound', 'Alat Zoom'],
      status: 'available',
      color: 'indigo',
      description: 'Aula Serbaguna Pangsub lokasi Gerai Pangsub Lantai 2 kapasitas 100 orang dilengkapi TV, Projector, Sound, dan alat Zoom.',
      pic_ga: 'Siti Rahmawati (GA)',
      image_url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&auto=format&fit=crop&q=80',
    },
  ];

  // Seed Dynamic Meeting Types (CRUD by Admin)
  db.meetingTypes = [
    {
      id: 'MT-01',
      name: 'Rapat Direksi & Dewan Komisaris',
      code: 'direksi',
      description: 'Rapat pimpinan puncak, evaluasi strategis korporat BUMD DKI Jakarta, RUPS, dan arahan Dewan Komisaris.',
      priority_level: 'high',
      color: 'purple',
      is_system: true,
    },
    {
      id: 'MT-02',
      name: 'Rapat Koordinasi Antar-Divisi',
      code: 'koordinasi',
      description: 'Sinergi operasional antar unit kerja (IT, GA, Keuangan, Komersial, Pergudangan PIBC).',
      priority_level: 'medium',
      color: 'blue',
      is_system: true,
    },
    {
      id: 'MT-03',
      name: 'Rapat Hybrid (Online & On-Site)',
      code: 'hybrid',
      description: 'Pertemuan tatap muka terintegrasi Zoom Room / Google Meet dengan peserta eksternal atau instansi DKI.',
      priority_level: 'medium',
      color: 'teal',
      is_system: true,
    },
    {
      id: 'MT-04',
      name: 'Rapat Evaluasi Rekanan / Vendor Eksternal',
      code: 'external',
      description: 'Negosiasi kontrak vendor, presentasi supplier mesin pangan, dan klarifikasi audit pihak ketiga.',
      priority_level: 'medium',
      color: 'amber',
      is_system: true,
    },
    {
      id: 'MT-05',
      name: 'Rapat Internal Tim / Divisi',
      code: 'internal',
      description: 'Weekly meeting unit kerja, briefing teknis staf, dan koordinasi rutin harian.',
      priority_level: 'low',
      color: 'slate',
      is_system: true,
    },
    {
      id: 'MT-06',
      name: 'Sosialisasi, Pelatihan & Townhall',
      code: 'sosialisasi',
      description: 'Sosialisasi regulasi BUMD pangan, upskilling karyawan, dan townhall direksi.',
      priority_level: 'high',
      color: 'indigo',
      is_system: true,
    },
  ];

  // Seed Dynamic Meeting Facilities (CRUD by Admin/GA/IT)
  db.meetingFacilities = [
    { id: 'FAC-GA-01', name: 'Sound System & 4x Wireless Mic', category: 'GA', description: 'Mixer audio, speaker surround & 4 unit mic wireless UHF', is_active: true, is_system: true },
    { id: 'FAC-GA-02', name: 'Laser Projector & Motorized Screen', category: 'GA', description: 'Proyektor laser 4500 Lumens & layar elektrik otomatis', is_active: true, is_system: true },
    { id: 'FAC-GA-03', name: 'Whiteboard Kaca Magnetik & Spidol', category: 'GA', description: 'Papan tulis kaca tempered magnetik lengkap spidol & penghapus', is_active: true, is_system: true },
    { id: 'FAC-GA-04', name: 'Podium & Flipchart Presentasi', category: 'GA', description: 'Podium kayu resmi Food Station & kertas flipchart plano', is_active: true, is_system: true },
    { id: 'FAC-GA-05', name: 'Tata Meja U-Shape / Boardroom VIP', category: 'GA', description: 'Konfigurasi meja U-shape atau oval eksekutif oleh tim GA', is_active: true, is_system: true },
    { id: 'FAC-GA-06', name: 'Air Conditioner Standby H-30 Menit', category: 'GA', description: 'Pendingin ruangan dinyalakan 30 menit sebelum rapat dimulai', is_active: true, is_system: true },
    { id: 'FAC-IT-01', name: 'Alat Zoom Room (Kamera PTZ 360 & Speakerphone)', category: 'IT', description: 'Perangkat konferensi video Zoom Room PTZ auto-framing & speakerphone', is_active: true, is_system: true },
    { id: 'FAC-IT-02', name: 'Smart TV 85" 4K HDR Display', category: 'IT', description: 'Layar monitor besar Ultra HD 4K HDMI/Wireless Cast', is_active: true, is_system: true },
    { id: 'FAC-IT-03', name: 'Kabel HDMI & Multi-Converter Type-C', category: 'IT', description: 'Kabel display 4K & adaptor MacBook/USB-C lengkap', is_active: true, is_system: true },
    { id: 'FAC-IT-04', name: 'Laser Pointer & Presenter Clicker', category: 'IT', description: 'Remote presenter wireless penggeser slide PPT', is_active: true, is_system: true },
    { id: 'FAC-IT-05', name: 'Koneksi LAN Dedicated High-Speed', category: 'IT', description: 'Port LAN RJ45 gigabit dedicated untuk streaming rapat lancar', is_active: true, is_system: true },
    { id: 'FAC-IT-06', name: 'Technical Support IT Standby On-Site', category: 'IT', description: 'Teknisi IT standby di ruangan mengawasi jalannya koneksi & perangkat', is_active: true, is_system: true },
  ];

  // Seed Authoritative Room Reservations
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  db.roomReservations = [
    {
      id: 'rsv-001',
      reservation_number: 'RSV-2026-0001',
      room_id: 'ROOM-01',
      room_name: 'Setrawangi',
      room_code: 'RR-SW',
      room_location: 'HO - Lantai 2',
      title: 'Rapat Koordinasi Distribusi Beras SPHP & Stabilisasi Harga Pangan',
      description: 'Evaluasi mingguan alokasi beras medium SPHP ke pasar tradisional dan retail modern DKI Jakarta bersama Direksi.',
      organizer_id: 'USR-SEKDIR',
      organizer_name: 'Dewi Anggraini, S.Sos',
      organizer_department: 'Sekretariat Direksi & Dewan Komisaris',
      organizer_phone: '081288997766',
      organizer_role: 'Sekretaris Direksi',
      attendees_count: 22,
      attendees_list: '1. Direktur Utama (Bpk. Pamrihadi Wiraryo)\n2. Direktur Operasional & Bisnis\n3. Kadiv MIS & TI (Budi Santoso)\n4. Kadiv Pengadaan & Perdagangan\n5. Tim Satgas Pangan DKI Jakarta',
      meeting_type: 'direksi',
      priority: 'high',
      date: todayStr,
      start_time: '09:00',
      end_time: '11:30',
      start_datetime: `${todayStr}T09:00:00+07:00`,
      end_datetime: `${todayStr}T11:30:00+07:00`,
      facilities_requested: ['Sound', 'Zoom', 'Projector'],
      consumption_requested: true,
      consumption_type: 'snack_box',
      consumption_pax: 25,
      consumption_serving_time: '09:15 WIB',
      consumption_notes: 'Snack box 25 pax & Kopi/Teh hangat dari pantry GA.',
      documentation_requested: true,
      documentation_type: 'lengkap',
      documentation_notes: 'Liputan dokumentasi foto resmi & rilis portal internal Food Station.',
      status: 'approved',
      approver_id: 'USR-02',
      approver_name: 'Siti Rahmawati (GA)',
      approved_at: `${todayStr}T07:30:00Z`,
      notes: 'Disetujui. Fasilitas Sound, Zoom, dan Projector siap digunakan.',
      created_at: `${todayStr}T07:00:00Z`,
      updated_at: `${todayStr}T07:30:00Z`,
    },
    {
      id: 'rsv-002',
      reservation_number: 'RSV-2026-0002',
      room_id: 'ROOM-02',
      room_name: 'Jasmine',
      room_code: 'RR-JAS',
      room_location: 'HO - Lantai 2',
      title: 'Review Kesiapan Audit Sistem IT & Migrasi Database Cloud',
      description: 'Pembahasan arsitektur high-availability PostgreSQL dan hardening PBKDF2 modul enterprise GABAH bersama tim IT & Auditor.',
      organizer_id: 'USR-01',
      organizer_name: 'Budi Santoso',
      organizer_department: 'Management Information System & TI',
      organizer_phone: '081234567890',
      organizer_role: 'Admin GABAH',
      attendees_count: 8,
      attendees_list: '1. Budi Santoso (Kadiv IT)\n2. Dani Setiawan (IT Support)\n3. Tim Auditor Eksternal (3 orang)\n4. Tim Database Engineer',
      meeting_type: 'hybrid',
      priority: 'medium',
      date: todayStr,
      start_time: '13:30',
      end_time: '15:30',
      start_datetime: `${todayStr}T13:30:00+07:00`,
      end_datetime: `${todayStr}T15:30:00+07:00`,
      facilities_requested: ['Projector', 'Bisa pinjam TV'],
      consumption_requested: true,
      consumption_type: 'snack_box',
      consumption_pax: 10,
      consumption_serving_time: '14:00 WIB',
      consumption_notes: 'Snack sore & Air mineral 10 botol.',
      documentation_requested: false,
      status: 'approved',
      approver_id: 'USR-02',
      approver_name: 'Siti Rahmawati (GA)',
      approved_at: `${todayStr}T08:00:00Z`,
      notes: 'Rapat hybrid bersama auditor eksternal.',
      created_at: `${todayStr}T07:45:00Z`,
      updated_at: `${todayStr}T08:00:00Z`,
    },
    {
      id: 'rsv-003',
      reservation_number: 'RSV-2026-0003',
      room_id: 'ROOM-05',
      room_name: 'Ruang Rapat Kantor Pasar',
      room_code: 'RR-KP',
      room_location: 'Kantor Pasar - Lantai 2',
      title: 'Koordinasi Pasokan Masuk Truk Beras Antar-Provinsi Jawa Barat & Jawa Timur',
      description: 'Rapat teknis dengan perwakilan paguyuban pedagang beras PIBC terkait optimalisasi antrean timbangan 60 ton.',
      organizer_id: 'USR-04',
      organizer_name: 'Hendra Wijaya',
      organizer_department: 'Divisi Perdagangan & Komersial',
      organizer_phone: '081299887766',
      organizer_role: 'Karyawan',
      attendees_count: 10,
      attendees_list: '1. Hendra Wijaya (Komersial)\n2. Agus Setiawan (PIBC)\n3. Pengurus Paguyuban Pedagang Beras (4 orang)\n4. Petugas Timbangan PIBC',
      meeting_type: 'external',
      priority: 'medium',
      date: tomorrow,
      start_time: '10:00',
      end_time: '12:00',
      start_datetime: `${tomorrow}T10:00:00+07:00`,
      end_datetime: `${tomorrow}T12:00:00+07:00`,
      facilities_requested: ['Bisa pinjam TV', 'Projector'],
      consumption_requested: true,
      consumption_type: 'snack_box',
      consumption_pax: 10,
      consumption_serving_time: '10:15 WIB',
      consumption_notes: 'Snack box tradisional & Kopi 10 pax.',
      documentation_requested: true,
      documentation_type: 'foto',
      documentation_notes: 'Foto kegiatan bersama perwakilan paguyuban pedagang PIBC.',
      status: 'approved',
      approver_id: 'USR-02',
      approver_name: 'Siti Rahmawati (GA)',
      approved_at: `${todayStr}T08:30:00Z`,
      created_at: `${todayStr}T08:15:00Z`,
      updated_at: `${todayStr}T08:30:00Z`,
    },
    {
      id: 'rsv-004',
      reservation_number: 'RSV-2026-0004',
      room_id: 'ROOM-04',
      room_name: 'Setra Pulen',
      room_code: 'RR-SP',
      room_location: 'HO - Lantai 2',
      title: 'Klarifikasi Evaluasi Vendor Servis Truk & Armada Operasional',
      description: 'Negosiasi penyesuaian tarif kontrak servis berkala armada logistik dengan Auto2000.',
      organizer_id: 'USR-02',
      organizer_name: 'Siti Rahmawati',
      organizer_department: 'General Affairs & Rumah Tangga',
      organizer_phone: '081398765432',
      organizer_role: 'GA',
      attendees_count: 6,
      attendees_list: '1. Siti Rahmawati (GA)\n2. Budi Hartono (GA Fleet)\n3. Hendra Gunawan (Auto2000)\n4. Service Advisor Auto2000',
      meeting_type: 'external',
      priority: 'low',
      date: tomorrow,
      start_time: '14:00',
      end_time: '15:30',
      start_datetime: `${tomorrow}T14:00:00+07:00`,
      end_datetime: `${tomorrow}T15:30:00+07:00`,
      facilities_requested: ['Bisa pinjam TV', 'Projector'],
      consumption_requested: false,
      documentation_requested: false,
      status: 'pending_approval',
      notes: 'Menunggu review dari tim GA untuk ketersediaan ruang.',
      created_at: `${todayStr}T09:00:00Z`,
      updated_at: `${todayStr}T09:00:00Z`,
    },
  ];

  // Synchronize Numbering Engine with existing assets
  AssetNumberingEngine.syncFromExistingAssets(db.assets);
}
