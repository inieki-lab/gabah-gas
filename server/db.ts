import { CANONICAL_TAXONOMY } from './taxonomy';
import { AssetNumberingEngine } from './numbering';
import { hashPassword } from './crypto';

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: 'Superadmin' | 'Admin GABAH' | 'IT' | 'GA' | 'Supply Chain' | 'PIBC' | 'Karyawan' | 'Auditor';
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
  created_at: string;
  expires_at: string;
  last_active_at: string;
  ip_address?: string;
  user_agent?: string;
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

// In-Memory Authoritative Data Store
export const db = {
  users: [] as ServerUser[],
  sessions: [] as ServerSession[],
  assets: [] as ServerAsset[],
  movements: [] as ServerAssetMovement[],
  loans: [] as ServerLoan[],
  tickets: [] as ServerTicket[],
  notifications: [] as ServerNotification[],
  auditLogs: [] as ServerAuditLog[],
  maintenances: [] as ServerMaintenance[],
};

// Seed Enterprise Master Users for 7 Active GABAH Roles with PBKDF2 Password Hashing
export function seedInitialData() {
  const defaultUsers: Array<Omit<ServerUser, 'password_hash' | 'password_salt'> & { initialPassword: string }> = [
    {
      id: 'USR-01',
      name: 'Budi Santoso',
      email: 'budi.santoso@foodstation.co.id',
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
      name: 'Ahmad Faisal',
      email: 'faisal.it@foodstation.co.id',
      role: 'IT',
      division: 'IT',
      department: 'Infrastruktur IT & Jaringan',
      phone: '081298765432',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'ItStaff#2026',
    },
    {
      id: 'USR-03',
      name: 'Siti Rahmawati',
      email: 'siti.ga@foodstation.co.id',
      role: 'GA',
      division: 'GA',
      department: 'Umum & Sarana Prasarana',
      phone: '081311223344',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'GaStaff#2026',
    },
    {
      id: 'USR-04',
      name: 'Bambang Sudiro',
      email: 'bambang.sc@foodstation.co.id',
      role: 'Supply Chain',
      division: 'SC',
      department: 'Logistik & Pabrik Pengolahan',
      phone: '081399887766',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'ScStaff#2026',
    },
    {
      id: 'USR-05',
      name: 'Joko Widodo C.',
      email: 'joko.pibc@foodstation.co.id',
      role: 'PIBC',
      division: 'PIBC',
      department: 'Operasional Kawasan PIBC',
      phone: '081577665544',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'PibcStaff#2026',
    },
    {
      id: 'USR-06',
      name: 'Dewi Lestari',
      email: 'dewi.lestari@foodstation.co.id',
      role: 'Karyawan',
      division: 'SC',
      department: 'Perdagangan & Distribusi Beras',
      phone: '081211223344',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'Karyawan#2026',
    },
    {
      id: 'USR-07',
      name: 'Hendro Wijaya',
      email: 'hendro.auditor@foodstation.co.id',
      role: 'Auditor',
      division: 'GA',
      department: 'Audit Internal',
      phone: '081244556677',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      initialPassword: 'Auditor#2026',
    },
    {
      id: 'USR-ADM-001',
      name: 'Rian Pratama, S.Kom.',
      email: 'admin.gabah@foodstation.co.id',
      role: 'Admin GABAH',
      division: 'IT',
      department: 'IT Enterprise Operations',
      phone: '081234567890',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      is_active: true,
      initialPassword: 'AdminGabah#2026',
    },
    {
      id: 'USR-KRY-002',
      name: 'Citra Dewi',
      email: 'budi.santoso@foodstation.id',
      role: 'Karyawan',
      division: 'Umum',
      department: 'Operasional',
      phone: '081211223399',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
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
      status: 'assigned',
      condition: 'good',
      location: 'Head Office - Lt. 2 Ruang IT',
      is_loanable: true,
      assigned_to: {
        id: 'USR-IT-001',
        name: 'Budi Santoso, S.Kom.',
        email: 'budi.it@foodstation.co.id',
        department: 'IT Support & Infra',
        assigned_date: '2024-02-20',
      },
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
      status: 'assigned',
      condition: 'good',
      location: 'Head Office - Ruang Keuangan',
      is_loanable: false,
      assigned_to: {
        id: 'USR-KRY-001',
        name: 'Citra Dewi, S.E.',
        email: 'citra.karyawan@foodstation.co.id',
        department: 'Keuangan & Akuntansi',
        assigned_date: '2023-08-20',
      },
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
      status: 'assigned',
      condition: 'good',
      location: 'Pasar Induk Beras Cipinang - Kantor Pos 1',
      is_loanable: false,
      assigned_to: {
        id: 'USR-PIBC-001',
        name: 'Bambang Sudarsono',
        email: 'bambang.pibc@foodstation.co.id',
        department: 'Operasional Pasar PIBC Cipinang',
        assigned_date: '2024-06-20',
      },
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
      borrower_id: 'USR-KRY-001',
      borrower_name: 'Citra Dewi, S.E.',
      borrower_department: 'Keuangan & Akuntansi',
      borrower_phone: '081211223344',
      purpose: 'Presentasi Laporan Keuangan ke Badan Pengawas BUMD DKI Jakarta',
      start_date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      due_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      status: 'borrowed',
      approver_id: 'USR-IT-001',
      approver_name: 'Budi Santoso, S.Kom.',
      approved_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      handover_by_id: 'USR-IT-001',
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
      borrower_id: 'USR-PIBC-001',
      borrower_name: 'Bambang Sudarsono',
      borrower_department: 'Operasional Pasar PIBC Cipinang',
      borrower_phone: '081577665544',
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
      reporter_id: 'USR-KRY-001',
      reporter_name: 'Citra Dewi, S.E.',
      reporter_department: 'Keuangan & Akuntansi',
      assigned_agent_id: 'USR-IT-001',
      assigned_agent_name: 'Budi Santoso, S.Kom.',
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
      reporter_id: 'USR-IT-001',
      reporter_name: 'Budi Santoso, S.Kom.',
      reporter_department: 'IT Support & Infra',
      assigned_agent_id: 'USR-GA-001',
      assigned_agent_name: 'Ahmad Fauzi, S.E.',
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

  // Synchronize Numbering Engine with existing assets
  AssetNumberingEngine.syncFromExistingAssets(db.assets);
}
