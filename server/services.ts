import { db, ServerAsset, ServerLoan, ServerTicket, ServerAssetMovement, ServerNotification, ServerAuditLog, ServerUser, ServerMeetingRoom, ServerRoomReservation, ServerMeetingType, ServerMeetingFacility } from './db';
import { CANONICAL_TAXONOMY, resolveTaxonomyByHumanName } from './taxonomy';
import { AssetNumberingEngine } from './numbering';
import { persistDataStore } from './persistence';
import { canSeeContract } from './contracts';

export class GabahDomainService {
  /**
   * Log action to immutable audit trail
   */
  static recordAudit(action: string, entity: string, details: string, user: { name: string; role: string }, entityId?: string) {
    const log: ServerAuditLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      entity,
      entity_id: entityId,
      user_name: user.name || 'System',
      user_role: user.role || 'System',
      details,
      timestamp: new Date().toISOString(),
    };
    db.auditLogs.unshift(log);
    persistDataStore().catch(err => console.warn('[GABAH Audit] Persistence notice:', err.message));
    return log;
  }

  /**
   * Dispatch targeted notification based on role and division
   */
  static notify(data: {
    recipient_role?: string;
    recipient_division?: string;
    recipient_user_id?: string;
    title: string;
    message: string;
    severity: 'critical' | 'action_required' | 'warning' | 'info' | 'success';
    category: 'sla' | 'warranty' | 'loan' | 'movement' | 'disposal' | 'contract' | 'reconciliation' | 'system';
    link_type?: 'asset' | 'loan' | 'ticket' | 'reconciliation';
    link_id?: string;
  }) {
    const notif: ServerNotification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recipient_role: data.recipient_role,
      recipient_division: data.recipient_division,
      recipient_user_id: data.recipient_user_id,
      title: data.title,
      message: data.message,
      severity: data.severity,
      category: data.category,
      link_type: data.link_type,
      link_id: data.link_id,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(notif);
    return notif;
  }

  /**
   * Filter assets based on user's role and division scope
   */
  static getScopedAssets(user: ServerUser): ServerAsset[] {
    // Superusers / Global Observers
    if (user.role === 'Admin GABAH' || user.role === 'Auditor') {
      return db.assets;
    }

    // Humas: "untuk tim humas ga perlu bisa lihat aset"
    if (user.role === 'Humas') {
      return [];
    }

    // Karyawan & Sekretaris Direksi can only view assigned assets or loanable pool assets
    if (user.role === 'Karyawan' || user.role === 'Sekretaris Direksi') {
      return db.assets.filter(a => a.assigned_to?.id === user.id || a.is_loanable);
    }

    // Operational Divisions: IT, GA, Supply Chain, PIBC
    if (user.role === 'IT') return db.assets.filter(a => a.owner_division === 'IT');
    // GA can see GA assets AND can view IT assets in read-only mode
    if (user.role === 'GA') return db.assets.filter(a => a.owner_division === 'GA' || a.owner_division === 'IT');
    if (user.role === 'Supply Chain') return db.assets.filter(a => a.owner_division === 'SC');
    if (user.role === 'PIBC') return db.assets.filter(a => a.owner_division === 'PIBC' || a.location.toLowerCase().includes('pibc'));

    return db.assets;
  }

  /**
   * Authoritative Asset Creation
   */
  static createAsset(payload: {
    category_name_or_code?: string;
    category_code?: string;
    category_name?: string;
    owner_division?: 'IT' | 'GA' | 'SC' | 'PIBC';
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
    condition?: 'new' | 'good' | 'fair' | 'poor' | 'broken';
    assigned_to_user_id?: string;
    license_detail?: any;
    notes?: string;
  }, actor: ServerUser): ServerAsset {
    // 1. Resolve taxonomy strictly from server master
    const rawCategory = payload.category_name_or_code || payload.category_code || payload.category_name || '';
    const taxonomy = resolveTaxonomyByHumanName(rawCategory, payload.owner_division);

    // Enforce Corporate Rules:
    // a) All IT items (IT-H & IT-S) belong to IT. GA only has read-only access.
    let resolvedOwnerDivision: 'IT' | 'GA' | 'SC' | 'PIBC' = taxonomy.owner_division;
    if (taxonomy.main_type === 'IT-H' || taxonomy.main_type === 'IT-S' || taxonomy.category_type === 'IT' || taxonomy.category_type === 'License') {
      resolvedOwnerDivision = 'IT';
    } else if (taxonomy.code === 'INV-F') {
      // b) All furniture (INV-F) belongs to GA ALWAYS, regardless of where it is physically placed.
      resolvedOwnerDivision = 'GA';
    } else if (payload.owner_division) {
      resolvedOwnerDivision = payload.owner_division;
    }

    // 2. Authorization check: Division Authority
    if (actor.role === 'Karyawan' || actor.role === 'Auditor' || actor.role === 'Humas' || actor.role === 'Sekretaris Direksi') {
      throw new Error('Peran Anda tidak berwenang mendaftarkan aset baru.');
    }
    if (actor.role !== 'Admin GABAH') {
      if (resolvedOwnerDivision === 'IT' && actor.role !== 'IT') {
        throw new Error(`Semua barang IT adalah milik Divisi IT. Divisi ${actor.role} hanya memiliki izin lihat (read-only).`);
      }
      if (resolvedOwnerDivision === 'GA' && actor.role !== 'GA' && taxonomy.code !== 'INV-F') {
        throw new Error(`Hanya Divisi GA yang berwenang mendaftarkan aset kategori ${taxonomy.name}.`);
      }
      if (resolvedOwnerDivision === 'SC' && actor.role !== 'Supply Chain') {
        throw new Error(`Hanya Divisi Supply Chain yang berwenang mendaftarkan aset kategori ${taxonomy.name}.`);
      }
      if (resolvedOwnerDivision === 'PIBC' && actor.role !== 'PIBC') {
        throw new Error(`Hanya Divisi PIBC yang berwenang mendaftarkan aset kategori ${taxonomy.name}.`);
      }
    }

    // Check for duplicate serial number
    if (payload.serial_number && payload.serial_number.trim()) {
      const existingSN = db.assets.find(
        a => a.serial_number && a.serial_number.trim().toLowerCase() === payload.serial_number!.trim().toLowerCase()
      );
      if (existingSN) {
        throw new Error(`Nomor Seri (Serial Number) "${payload.serial_number.trim()}" sudah terdaftar pada aset ${existingSN.asset_number} (${existingSN.name}).`);
      }
    }

    // Check for duplicate corporate/Accurate asset number
    if (payload.corporate_asset_number && payload.corporate_asset_number.trim()) {
      const existingERP = db.assets.find(
        a => a.corporate_asset_number && a.corporate_asset_number.trim().toLowerCase() === payload.corporate_asset_number!.trim().toLowerCase()
      );
      if (existingERP) {
        throw new Error(`Nomor Aset Accurate/ERP "${payload.corporate_asset_number.trim()}" sudah terdaftar pada aset ${existingERP.asset_number} (${existingERP.name}).`);
      }
    }

    // 3. Atomically generate official asset number
    const assetNumber = AssetNumberingEngine.generateAssetNumber(resolvedOwnerDivision, taxonomy.code);

    // 4. Resolve assignment if provided
    let assignedObj = null;
    let initialStatus: ServerAsset['status'] = payload.is_loanable ? 'available' : 'active';

    if (payload.assigned_to_user_id) {
      const assignedUser = db.users.find(u => u.id === payload.assigned_to_user_id);
      if (assignedUser) {
        assignedObj = {
          id: assignedUser.id,
          name: assignedUser.name,
          email: assignedUser.email,
          department: assignedUser.department,
          assigned_date: new Date().toISOString().split('T')[0],
        };
        initialStatus = 'assigned';
      }
    }

    const newAsset: ServerAsset = {
      id: `AST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      asset_number: assetNumber,
      corporate_asset_number: payload.corporate_asset_number || null,
      name: payload.name.trim(),
      category_code: taxonomy.code,
      category_type: taxonomy.category_type,
      owner_division: resolvedOwnerDivision,
      brand: payload.brand?.trim() || '',
      model: payload.model?.trim() || '',
      serial_number: payload.serial_number?.trim() || `SN-${Date.now().toString().slice(-6)}`,
      specifications: payload.specifications?.trim() || '',
      purchase_date: payload.purchase_date || new Date().toISOString().split('T')[0],
      purchase_price: Number(payload.purchase_price) || 0,
      warranty_until: payload.warranty_until || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: initialStatus,
      condition: payload.condition || 'new',
      location: payload.location?.trim() || 'Head Office - Gudang Utama',
      is_loanable: payload.is_loanable ?? taxonomy.is_loanable_by_default,
      assigned_to: assignedObj,
      license_detail: payload.license_detail,
      notes: payload.notes?.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.assets.unshift(newAsset);

    // Record audit
    this.recordAudit('ASSET_CREATED', 'Assets', `Mendaftarkan aset baru ${newAsset.asset_number} (${newAsset.name}) [Owner: ${newAsset.owner_division}]`, actor, newAsset.id);

    return newAsset;
  }

  /**
   * Asset Assignment Mutation
   */
  static assignAsset(assetId: string, targetUserId: string, reason: string, actor: ServerUser): ServerAsset {
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) throw new Error('Aset tidak ditemukan');

    // Corporate Division Authority
    if (actor.role !== 'Admin GABAH') {
      const isITAsset = asset.owner_division === 'IT' || asset.category_type === 'IT';
      if (isITAsset && actor.role !== 'IT') {
        throw new Error('Semua barang IT adalah milik Divisi IT. Divisi GA hanya memiliki izin lihat (read-only) dan tidak berwenang menugaskan aset ini.');
      }
      if (asset.owner_division === 'GA' && actor.role !== 'GA') {
        throw new Error('Aset General Affair (GA) hanya dapat ditugaskan oleh personel GA atau Admin GABAH.');
      }
      if (asset.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        throw new Error('Aset Supply Chain hanya dapat ditugaskan oleh personel Supply Chain atau Admin GABAH.');
      }
      if (asset.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        throw new Error('Aset PIBC hanya dapat ditugaskan oleh personel PIBC atau Admin GABAH.');
      }
    }

    const previousUser = asset.assigned_to?.name || 'Gudang / Pool';

    // Support Unassign (Return to Pool/Warehouse as available/idle)
    if (!targetUserId) {
      asset.assigned_to = undefined;
      asset.status = 'available';
      asset.updated_at = new Date().toISOString();

      const movement: ServerAssetMovement = {
        id: `MOV-${Date.now()}`,
        asset_id: asset.id,
        asset_number: asset.asset_number,
        from_user_name: previousUser,
        to_user_id: '',
        to_user_name: 'Gudang / Pool (Tersedia)',
        from_location: asset.location,
        to_location: asset.location,
        reason: reason || 'Pengembalian aset ke gudang/pool penampungan (Idle)',
        performed_by_id: actor.id,
        performed_by_name: actor.name,
        created_at: new Date().toISOString(),
      };
      db.movements.unshift(movement);
      this.recordAudit('ASSET_UNASSIGNED', 'Assets', `Melepaskan penugasan aset ${asset.asset_number} dari ${previousUser} kembali ke Pool Gudang`, actor, asset.id);
      return asset;
    }

    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) throw new Error('User penerima tidak ditemukan');

    asset.assigned_to = {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      department: targetUser.department,
      assigned_date: new Date().toISOString().split('T')[0],
    };
    asset.status = 'assigned';
    asset.updated_at = new Date().toISOString();

    // Record movement
    const movement: ServerAssetMovement = {
      id: `MOV-${Date.now()}`,
      asset_id: asset.id,
      asset_number: asset.asset_number,
      from_user_name: previousUser,
      to_user_id: targetUser.id,
      to_user_name: targetUser.name,
      from_location: asset.location,
      to_location: asset.location,
      reason: reason || 'Penugasan aset karyawan',
      performed_by_id: actor.id,
      performed_by_name: actor.name,
      created_at: new Date().toISOString(),
    };
    db.movements.unshift(movement);

    this.recordAudit('ASSET_ASSIGNED', 'Assets', `Menugaskan aset ${asset.asset_number} dari ${previousUser} ke ${targetUser.name}`, actor, asset.id);
    return asset;
  }

  /**
   * Asset Location Movement Mutation
   */
  static moveAsset(assetId: string, newLocation: string, reason: string, actor: ServerUser): ServerAsset {
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) throw new Error('Aset tidak ditemukan');

    // Corporate Security Rule: All IT assets belong to IT. GA only has read-only access.
    if (asset.owner_division === 'IT' && actor.role === 'GA') {
      throw new Error('Semua barang IT adalah milik Divisi IT. Divisi GA hanya memiliki izin lihat (read-only) dan tidak berwenang merelokasi aset IT.');
    }

    const oldLocation = asset.location;
    asset.location = newLocation;
    asset.updated_at = new Date().toISOString();

    const movement: ServerAssetMovement = {
      id: `MOV-${Date.now()}`,
      asset_id: asset.id,
      asset_number: asset.asset_number,
      from_location: oldLocation,
      to_location: newLocation,
      reason: reason || 'Relokasi fisik aset',
      performed_by_id: actor.id,
      performed_by_name: actor.name,
      created_at: new Date().toISOString(),
    };
    db.movements.unshift(movement);

    this.recordAudit('ASSET_MOVED', 'Assets', `Memindahkan lokasi aset ${asset.asset_number} dari "${oldLocation}" ke "${newLocation}"`, actor, asset.id);

    return asset;
  }

  /**
   * Asset Lifecycle Mutation (Repair, Damaged, Cannibalize, Disposal, Auction)
   */
  static mutateLifecycle(assetId: string, action: 'repair' | 'damaged' | 'cannibalize' | 'propose_disposal' | 'approve_disposal' | 'auction', notes: string, actor: ServerUser): ServerAsset {
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) throw new Error('Aset tidak ditemukan');

    // Corporate Security Rule: All IT assets belong to IT. GA only has read-only access.
    if (asset.owner_division === 'IT' && actor.role === 'GA') {
      throw new Error('Semua barang IT adalah milik Divisi IT. Divisi GA hanya memiliki izin lihat (read-only) dan tidak berwenang mengubah lifecycle aset IT.');
    }

    switch (action) {
      case 'repair':
        asset.status = 'in_repair';
        break;
      case 'damaged':
        asset.status = 'damaged';
        asset.condition = 'broken';
        break;
      case 'cannibalize':
        asset.status = 'cannibalized';
        asset.condition = 'broken';
        break;
      case 'propose_disposal':
        asset.status = 'pending_disposal';
        break;
      case 'approve_disposal':
        if (actor.role !== 'Admin GABAH') {
          throw new Error('Hanya Admin GABAH yang berwenang menyetujui penghapusan aset.');
        }
        asset.status = 'disposed';
        break;
      case 'auction':
        asset.status = 'pending_auction';
        break;
    }

    asset.updated_at = new Date().toISOString();
    this.recordAudit('LIFECYCLE_MUTATION', 'Assets', `Mutasi lifecycle aset ${asset.asset_number} -> ${asset.status}: ${notes}`, actor, asset.id);

    return asset;
  }

  /**
   * Loan Request & Collision Detection
   */
  static requestLoan(payload: {
    asset_id: string;
    borrower_id: string;
    purpose: string;
    start_date: string;
    due_date: string;
  }, actor: ServerUser): ServerLoan {
    const asset = db.assets.find(a => a.id === payload.asset_id);
    if (!asset) throw new Error('Aset tidak ditemukan');
    if (!asset.is_loanable) throw new Error('Aset ini tidak dikonfigurasikan sebagai aset pinjaman (pool).');

    const start = new Date(payload.start_date).getTime();
    const due = new Date(payload.due_date).getTime();

    if (isNaN(start) || isNaN(due) || start >= due) {
      throw new Error('Jadwal peminjaman tidak valid. Tanggal kembali harus setelah tanggal mulai.');
    }

    // Authoritative Collision Check: Strictly per-asset on confirmed reservations (approved / borrowed)
    // Different assets (e.g. laptop IT + vehicle GA) can be borrowed concurrently by the same user with zero conflict.
    const conflicting = db.loans.find(l => {
      if (l.asset_id !== asset.id) return false;
      if (!['approved', 'borrowed'].includes(l.status)) return false;

      const existingStart = new Date(l.start_date).getTime();
      const existingDue = new Date(l.due_date).getTime();

      return start < existingDue && due > existingStart;
    });

    if (conflicting) {
      throw new Error(`Tabrakan Jadwal! Aset "${asset.name}" (${asset.asset_number}) sudah dipinjam / disetujui pada periode tersebut (${conflicting.start_date.split('T')[0]} s/d ${conflicting.due_date.split('T')[0]}).`);
    }

    const borrower = db.users.find(u => u.id === payload.borrower_id) || actor;

    const loanNumber = AssetNumberingEngine.generateLoanNumber();
    const newLoan: ServerLoan = {
      id: `LOAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      loan_number: loanNumber,
      asset_id: asset.id,
      asset_name: asset.name,
      asset_number: asset.asset_number,
      owner_division: asset.owner_division,
      borrower_id: borrower.id,
      borrower_name: borrower.name,
      borrower_department: borrower.department,
      borrower_phone: borrower.phone || '-',
      purpose: payload.purpose.trim(),
      start_date: payload.start_date,
      due_date: payload.due_date,
      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.loans.unshift(newLoan);

    // Dispatch attention notification to owner division
    this.notify({
      recipient_role: asset.owner_division,
      recipient_division: asset.owner_division,
      title: `Permohonan Pinjaman Baru: ${loanNumber}`,
      message: `${borrower.name} (${borrower.department}) mengajukan pinjaman ${asset.name} (${asset.asset_number}). Persetujuan dibutuhkan dari Divisi ${asset.owner_division}.`,
      severity: 'action_required',
      category: 'loan',
      link_type: 'loan',
      link_id: newLoan.id,
    });

    this.recordAudit('LOAN_REQUESTED', 'Loans', `Mengajukan pinjaman ${loanNumber} untuk aset ${asset.name} (${asset.asset_number}) [Approver: Divisi ${asset.owner_division}]`, actor, newLoan.id);

    return newLoan;
  }

  /**
   * Loan Approval by Authoritative Division
   */
  static approveLoan(loanId: string, actor: ServerUser): ServerLoan {
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Data pinjaman tidak ditemukan');

    // Authority verification: IT for IT assets, GA for GA assets, Admin GABAH everywhere
    if (actor.role !== 'Admin GABAH') {
      if (loan.owner_division === 'IT' && actor.role !== 'IT') {
        throw new Error('Akses ditolak: Hanya Divisi IT atau Admin GABAH yang berwenang menyetujui peminjaman aset IT (laptop/proyektor).');
      }
      if (loan.owner_division === 'GA' && actor.role !== 'GA') {
        throw new Error('Akses ditolak: Hanya Divisi GA atau Admin GABAH yang berwenang menyetujui peminjaman aset GA (kendaraan operasional).');
      }
      if (loan.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        throw new Error('Akses ditolak: Hanya Divisi Supply Chain atau Admin GABAH yang berwenang menyetujui peminjaman aset SC.');
      }
    }

    // Re-verify no collision with other ALREADY APPROVED / BORROWED loans for THIS specific asset
    const start = new Date(loan.start_date).getTime();
    const due = new Date(loan.due_date).getTime();
    const conflicting = db.loans.find(l => {
      if (l.id === loan.id) return false;
      if (l.asset_id !== loan.asset_id) return false;
      if (!['approved', 'borrowed'].includes(l.status)) return false;

      const existingStart = new Date(l.start_date).getTime();
      const existingDue = new Date(l.due_date).getTime();

      return start < existingDue && due > existingStart;
    });

    if (conflicting) {
      throw new Error(`Tidak dapat disetujui: Tabrakan jadwal dengan peminjaman ${conflicting.loan_number} (${conflicting.borrower_name}) yang telah disetujui untuk aset ini.`);
    }

    loan.status = 'approved';
    loan.approver_id = actor.id;
    loan.approver_name = actor.name;
    loan.approved_at = new Date().toISOString();
    loan.updated_at = new Date().toISOString();

    // Mark asset as reserved
    const asset = db.assets.find(a => a.id === loan.asset_id);
    if (asset) {
      asset.status = 'reserved';
    }

    this.recordAudit('LOAN_APPROVED', 'Loans', `Menyetujui pinjaman ${loan.loan_number} (${loan.asset_name}) oleh ${actor.name} (${actor.role})`, actor, loan.id);

    this.notify({
      recipient_user_id: loan.borrower_id,
      title: `Pinjaman Disetujui: ${loan.loan_number}`,
      message: `Permohonan pinjaman ${loan.asset_name} telah disetujui oleh Divisi ${loan.owner_division} (${actor.name}). Siap untuk serah terima barang.`,
      severity: 'success',
      category: 'loan',
      link_type: 'loan',
      link_id: loan.id,
    });

    return loan;
  }

  /**
   * Loan Rejection (Owner-division authority, mirrors approveLoan)
   */
  static rejectLoan(loanId: string, reason: string, actor: ServerUser): ServerLoan {
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Data pinjaman tidak ditemukan');

    if (loan.status !== 'pending_approval') {
      throw new Error('Hanya pinjaman berstatus menunggu persetujuan yang dapat ditolak.');
    }

    // Authority verification: same matrix as approveLoan
    if (actor.role !== 'Admin GABAH') {
      if (loan.owner_division === 'IT' && actor.role !== 'IT') {
        throw new Error('Akses ditolak: Hanya Divisi IT atau Admin GABAH yang berwenang menolak peminjaman aset IT.');
      }
      if (loan.owner_division === 'GA' && actor.role !== 'GA') {
        throw new Error('Akses ditolak: Hanya Divisi GA atau Admin GABAH yang berwenang menolak peminjaman aset GA.');
      }
      if (loan.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        throw new Error('Akses ditolak: Hanya Divisi Supply Chain atau Admin GABAH yang berwenang menolak peminjaman aset SC.');
      }
      if (loan.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        throw new Error('Akses ditolak: Hanya Divisi PIBC atau Admin GABAH yang berwenang menolak peminjaman aset PIBC.');
      }
    }

    if (actor.role === 'Auditor') {
      throw new Error('Akses ditolak: Auditor bersifat read-only.');
    }

    loan.status = 'rejected';
    loan.rejection_reason = reason || 'Ditolak oleh divisi pemilik aset';
    loan.updated_at = new Date().toISOString();

    this.recordAudit('LOAN_REJECTED', 'Loans', `Menolak pinjaman ${loan.loan_number} (${loan.asset_name}) — ${loan.rejection_reason}`, actor, loan.id);

    this.notify({
      recipient_user_id: loan.borrower_id,
      title: `Pinjaman Ditolak: ${loan.loan_number}`,
      message: `Permohonan pinjaman ${loan.asset_name} ditolak. Alasan: ${loan.rejection_reason}`,
      severity: 'warning',
      category: 'loan',
      link_type: 'loan',
      link_id: loan.id,
    });

    return loan;
  }

  /**
   * Loan Handover Execution (Fisik diserahkan)
   */
  static handoverLoan(loanId: string, handoverNotes: string, actor: ServerUser): ServerLoan {
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Data pinjaman tidak ditemukan');

    loan.status = 'borrowed';
    loan.handover_by_id = actor.id;
    loan.handover_at = new Date().toISOString();
    loan.handover_notes = handoverNotes || 'Unit diserahkan dalam kondisi baik.';
    loan.updated_at = new Date().toISOString();

    const asset = db.assets.find(a => a.id === loan.asset_id);
    if (asset) {
      asset.status = 'assigned';
    }

    this.recordAudit('LOAN_HANDOVER', 'Loans', `Serah terima fisik pinjaman ${loan.loan_number} ke ${loan.borrower_name}`, actor, loan.id);

    return loan;
  }

  /**
   * Loan Return & Inspection
   */
  static returnLoan(loanId: string, condition: 'good' | 'fair' | 'poor' | 'broken', returnNotes: string, actor: ServerUser): ServerLoan {
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) throw new Error('Data pinjaman tidak ditemukan');

    loan.status = 'returned';
    loan.actual_returned_at = new Date().toISOString();
    loan.return_condition = condition;
    loan.return_inspected_by_id = actor.id;
    loan.updated_at = new Date().toISOString();

    const asset = db.assets.find(a => a.id === loan.asset_id);
    if (asset) {
      asset.status = condition === 'broken' ? 'damaged' : 'available';
      asset.condition = condition;
      asset.location = 'Head Office - Gudang Pool';
    }

    this.recordAudit('LOAN_RETURNED', 'Loans', `Pengembalian pinjaman ${loan.loan_number}. Kondisi: ${condition}. Catatan: ${returnNotes}`, actor, loan.id);

    return loan;
  }

  /**
   * Helpdesk Ticket Creation with Authoritative SLA Deadline
   */
  static createTicket(payload: {
    title: string;
    description: string;
    category: 'IT' | 'GA' | 'SC' | 'PIBC';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    related_asset_id?: string;
    contract_id?: string;
  }, actor: ServerUser): ServerTicket {
    const slaHours = {
      urgent: 4,
      high: 8,
      medium: 24,
      low: 48,
    }[payload.priority];

    const deadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const ticketNumber = AssetNumberingEngine.generateTicketNumber();

    let relatedAssetName = '';
    let relatedAssetNumber = '';
    if (payload.related_asset_id) {
      const ast = db.assets.find(a => a.id === payload.related_asset_id);
      if (ast) {
        relatedAssetName = ast.name;
        relatedAssetNumber = ast.asset_number;
      }
    }

    const newTicket: ServerTicket = {
      id: `TKT-${Date.now()}`,
      ticket_number: ticketNumber,
      ticket_code: ticketNumber,
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category,
      priority: payload.priority,
      status: 'open',
      reporter_id: actor.id,
      reporter_name: actor.name,
      reporter_department: actor.department,
      related_asset_id: payload.related_asset_id,
      related_asset_name: relatedAssetName,
      related_asset_number: relatedAssetNumber,
      sla_hours: slaHours,
      sla_resolution_deadline: deadline,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.tickets.unshift(newTicket);

    // Linked contract (optional): Ticket = pekerjaan atas suatu Contract, bukan kategori
    // SECURITY: linkage is only honored when the actor may see the contract —
    // client input cannot probe restricted contracts through ticket creation.
    if (payload.contract_id) {
      const contract = db.contracts.find(c => c.id === payload.contract_id);
      if (contract && canSeeContract(actor, contract)) {
        newTicket.contract_id = contract.id;
        this.recordAudit('TICKET_LINKED_TO_CONTRACT', 'Tickets', `Tiket ${ticketNumber} ditautkan ke kontrak ${contract.contract_number}`, actor, newTicket.id);
      }
    }

    // Notify respective division (IT covers software/license/SaaS)
    const targetDivision = payload.category;
    this.notify({
      recipient_role: targetDivision,
      recipient_division: targetDivision,
      title: `Tiket Baru: [${payload.priority.toUpperCase()}] ${ticketNumber}`,
      message: `${actor.name} (${actor.department}) melaporkan: ${payload.title}`,
      severity: payload.priority === 'urgent' ? 'critical' : payload.priority === 'high' ? 'action_required' : 'info',
      category: 'sla',
      link_type: 'ticket',
      link_id: newTicket.id,
    });

    this.recordAudit('TICKET_CREATED', 'Tickets', `Membuat tiket helpdesk ${ticketNumber} (Prioritas: ${payload.priority}, SLA: ${slaHours}h)`, actor, newTicket.id);

    return newTicket;
  }

  /**
   * Dashboard Attention Center Query (Dynamic computation of pending/critical actions)
   */
  static getAttentionCenter(user: ServerUser) {
    const now = Date.now();
    const items: Array<{
      id: string;
      type: 'sla_breach' | 'sla_warning' | 'loan_pending' | 'loan_overdue' | 'warranty_expiring' | 'unmatched_reconciliation';
      title: string;
      description: string;
      severity: 'critical' | 'action_required' | 'warning';
      link_type: 'ticket' | 'loan' | 'asset' | 'reconciliation';
      link_id: string;
      meta?: any;
    }> = [];

    // 1. SLA Breach / Approaching Breach
    for (const t of db.tickets) {
      if (['open', 'assigned', 'in_progress'].includes(t.status)) {
        const deadline = new Date(t.sla_resolution_deadline).getTime();
        const diffHours = (deadline - now) / (3600 * 1000);

        if (diffHours < 0) {
          items.push({
            id: `ATT-SLA-BREACH-${t.id}`,
            type: 'sla_breach',
            title: `SLA Terlampaui: ${t.ticket_number}`,
            description: `Tiket "${t.title}" telah melewati batas waktu SLA resolusi (${t.sla_hours} jam).`,
            severity: 'critical',
            link_type: 'ticket',
            link_id: t.id,
          });
        } else if (diffHours < 2) {
          items.push({
            id: `ATT-SLA-WARN-${t.id}`,
            type: 'sla_warning',
            title: `SLA Mendekati Batas: ${t.ticket_number}`,
            description: `Tiket "${t.title}" tersisa ${diffHours.toFixed(1)} jam sebelum pelanggaran SLA.`,
            severity: 'action_required',
            link_type: 'ticket',
            link_id: t.id,
          });
        }
      }
    }

    // 2. Loans Pending Approval for this user's division
    for (const l of db.loans) {
      if (l.status === 'pending_approval') {
        items.push({
          id: `ATT-LOAN-PENDING-${l.id}`,
          type: 'loan_pending',
          title: `Menunggu Persetujuan: ${l.loan_number}`,
          description: `${l.borrower_name} meminjam ${l.asset_name} (${l.owner_division}) untuk keperluan: "${l.purpose}".`,
          severity: 'action_required',
          link_type: 'loan',
          link_id: l.id,
        });
      }

      // Check Overdue Loans
      if (l.status === 'borrowed') {
        const due = new Date(l.due_date).getTime();
        if (now > due) {
          items.push({
            id: `ATT-LOAN-OVERDUE-${l.id}`,
            type: 'loan_overdue',
            title: `Pinjaman Jatuh Tempo: ${l.loan_number}`,
            description: `Peminjaman aset ${l.asset_number} oleh ${l.borrower_name} telah melewati jadwal pengembalian.`,
            severity: 'critical',
            link_type: 'loan',
            link_id: l.id,
          });
        }
      }
    }

    // 3. Warranty Expiring within 30 days
    for (const a of db.assets) {
      if (a.warranty_until && a.status !== 'disposed') {
        const warrantyDate = new Date(a.warranty_until).getTime();
        const daysLeft = (warrantyDate - now) / (24 * 3600 * 1000);
        if (daysLeft >= 0 && daysLeft <= 30) {
          items.push({
            id: `ATT-WTY-${a.id}`,
            type: 'warranty_expiring',
            title: `Garansi / Lisensi Segera Berakhir: ${a.asset_number}`,
            description: `${a.name} (${a.brand}) masa garansi/lisensi berakhir dalam ${Math.ceil(daysLeft)} hari (${a.warranty_until}).`,
            severity: 'warning',
            link_type: 'asset',
            link_id: a.id,
          });
        }
      }
    }

    return items;
  }

  /**
   * Accurate ERP Reconciliation Query
   */
  static getReconciliationData() {
    const totalAssets = db.assets.length;
    const matched = db.assets.filter(a => a.corporate_asset_number && a.corporate_asset_number.trim().length > 0);
    const unmatched = db.assets.filter(a => !a.corporate_asset_number || a.corporate_asset_number.trim().length === 0);

    return {
      stats: {
        total_gabah_assets: totalAssets,
        matched_count: matched.length,
        unmatched_count: unmatched.length,
        reconciliation_percentage: totalAssets > 0 ? Math.round((matched.length / totalAssets) * 100) : 100,
      },
      items: db.assets.map(a => ({
        id: a.id,
        asset_number: a.asset_number,
        corporate_asset_number: a.corporate_asset_number || null,
        name: a.name,
        category_code: a.category_code,
        owner_division: a.owner_division,
        location: a.location,
        status: a.status,
        match_status: a.corporate_asset_number ? 'matched' : 'unmatched',
      })),
    };
  }

  /**
   * Meeting Rooms & Reservations
   */
  static getMeetingRooms(): ServerMeetingRoom[] {
    return db.rooms || [];
  }

  static getRoomReservations(query?: { room_id?: string; date?: string; status?: string; organizer_id?: string }): ServerRoomReservation[] {
    let list = db.roomReservations || [];
    if (query?.room_id) list = list.filter(r => r.room_id === query.room_id);
    if (query?.date) list = list.filter(r => r.date === query.date);
    if (query?.status) list = list.filter(r => r.status === query.status);
    if (query?.organizer_id) list = list.filter(r => r.organizer_id === query.organizer_id);
    return list;
  }

  static requestRoomReservation(payload: {
    room_id: string;
    title: string;
    description?: string;
    attendees_count: number;
    attendees_list?: string;
    meeting_type?: string;
    priority?: 'high' | 'medium' | 'low';
    date: string; // YYYY-MM-DD
    start_time: string; // HH:mm
    end_time: string; // HH:mm
    facilities_requested?: string[];
    consumption_requested?: boolean;
    consumption_type?: 'snack_box' | 'lunch_box' | 'coffee_tea' | 'vip_buffet' | 'custom';
    consumption_pax?: number;
    consumption_serving_time?: string;
    consumption_notes?: string;
    documentation_requested?: boolean;
    documentation_type?: 'foto' | 'video' | 'press_release' | 'notulensi' | 'lengkap';
    documentation_notes?: string;
    override_conflict?: boolean;
    interruption_reason?: string;
    notes?: string;
  }, actor: ServerUser): ServerRoomReservation {
    if (actor.role === 'Auditor') {
      throw new Error('Akses ditolak: Auditor hanya memiliki izin baca (read-only).');
    }

    const room = (db.rooms || []).find(r => r.id === payload.room_id);
    if (!room) throw new Error('Ruang rapat tidak ditemukan.');

    if (room.status === 'maintenance') {
      throw new Error(`Ruangan "${room.name}" saat ini sedang dalam pemeliharaan/perbaikan.`);
    }

    if (!payload.title || !payload.title.trim()) {
      throw new Error('Judul / Agenda rapat wajib diisi.');
    }

    if (!payload.date || !payload.start_time || !payload.end_time) {
      throw new Error('Tanggal, jam mulai, dan jam selesai wajib diisi.');
    }

    if (payload.start_time >= payload.end_time) {
      throw new Error('Jam mulai harus lebih awal dari jam selesai rapat.');
    }

    if (Number(payload.attendees_count) > room.capacity) {
      throw new Error(`Jumlah peserta (${payload.attendees_count}) melebihi kapasitas maksimum ruangan ${room.name} (${room.capacity} orang).`);
    }

    // Anti-Collision Check: StartA < EndB && EndA > StartB on the same date for this room
    const conflicting = (db.roomReservations || []).find(r => {
      if (r.room_id !== room.id) return false;
      if (['rejected', 'cancelled'].includes(r.status)) return false;
      if (r.date !== payload.date) return false;
      return payload.start_time < r.end_time && payload.end_time > r.start_time;
    });

    const isPrivilegedInterrupter =
      actor.role === 'Admin GABAH' ||
      actor.role === 'GA' ||
      actor.role === 'Sekretaris Direksi';

    if (conflicting) {
      if (payload.override_conflict && isPrivilegedInterrupter) {
        // Privileged Interruption: Find alternative room with sufficient capacity if available
        const altRoom = (db.rooms || []).find(other => {
          if (other.id === room.id) return false;
          if (other.capacity < conflicting.attendees_count) return false;
          if (other.status === 'maintenance') return false;
          // Check collision in other room
          const hasOverlap = (db.roomReservations || []).some(r => {
            if (r.id === conflicting.id) return false;
            if (r.room_id !== other.id) return false;
            if (['rejected', 'cancelled'].includes(r.status)) return false;
            if (r.date !== conflicting.date) return false;
            return conflicting.start_time < r.end_time && conflicting.end_time > r.start_time;
          });
          return !hasOverlap;
        });

        const originalRoomName = conflicting.room_name;
        conflicting.is_interrupted = true;
        conflicting.interrupted_by_name = `${actor.name} (${actor.role})`;
        conflicting.interruption_reason = payload.interruption_reason || `Diinterupsi untuk Prioritas Jadwal Direksi: "${payload.title}"`;
        conflicting.original_room_name = originalRoomName;

        if (altRoom) {
          conflicting.room_id = altRoom.id;
          conflicting.room_name = altRoom.name;
          conflicting.room_code = altRoom.code;
          conflicting.room_location = `${altRoom.building} - ${altRoom.floor}`;
          conflicting.notes = (conflicting.notes ? conflicting.notes + ' | ' : '') + `[Jadwal Digeser] Dipindahkan dari ${originalRoomName} ke ${altRoom.name} karena agenda mendesak Direksi oleh ${actor.name} (${actor.role}).`;
          this.notify({
            recipient_user_id: conflicting.organizer_id,
            title: `Perubahan Ruangan: Dialihkan ke ${altRoom.name}`,
            message: `Jadwal reservasi Anda (${conflicting.reservation_number}) pada ${conflicting.date} (${conflicting.start_time}-${conflicting.end_time}) dialihkan dari ${originalRoomName} ke ${altRoom.name} untuk Rapat Direksi oleh ${actor.name} (${actor.role}).`,
            severity: 'critical',
            category: 'system',
          });
        } else {
          conflicting.status = 'rejected';
          conflicting.rejection_reason = `Jadwal diinterupsi oleh ${actor.name} (${actor.role}) untuk kebutuhan prioritas Rapat Direksi: "${payload.title}". Mohon ajukan jadwal di ruangan lain.`;
          this.notify({
            recipient_user_id: conflicting.organizer_id,
            title: `Jadwal Rapat Dibatalkan/Diinterupsi: ${originalRoomName}`,
            message: `Reservasi Anda (${conflicting.reservation_number}) pada ${conflicting.date} (${conflicting.start_time}-${conflicting.end_time}) terpaksa dibatalkan karena ruangan digunakan untuk Rapat Direksi oleh ${actor.name} (${actor.role}).`,
            severity: 'critical',
            category: 'system',
          });
        }
        conflicting.updated_at = new Date().toISOString();

        this.recordAudit(
          'ROOM_RESERVATION_INTERRUPTED',
          'MeetingRooms',
          `Interupsi jadwal ${conflicting.reservation_number} di ${originalRoomName} oleh ${actor.name} (${actor.role}) untuk Rapat Direksi: ${payload.title}. Status pemindahan: ${altRoom ? 'Dipindahkan ke ' + altRoom.name : 'Dibatalkan/Ruangan penuh'}`,
          actor,
          conflicting.id
        );
      } else {
        const err: any = new Error(
          `Tabrakan Jadwal! Ruangan "${room.name}" sudah dipesan pada ${payload.date} pukul ${conflicting.start_time} - ${conflicting.end_time} untuk agenda "${conflicting.title}" oleh ${conflicting.organizer_name} (${conflicting.organizer_department}).`
        );
        err.conflict = {
          reservation_number: conflicting.reservation_number,
          title: conflicting.title,
          organizer_name: conflicting.organizer_name,
          organizer_department: conflicting.organizer_department,
          date: conflicting.date,
          start_time: conflicting.start_time,
          end_time: conflicting.end_time,
          room_name: room.name,
          room_id: room.id,
          priority: conflicting.priority,
        };
        err.can_override = isPrivilegedInterrupter;
        throw err;
      }
    }

    const year = new Date().getFullYear();
    const existingCount = (db.roomReservations || []).length + 1;
    const reservationNumber = `RSV-${year}-${String(existingCount).padStart(4, '0')}`;
    const isAutoApproved = actor.role === 'Admin GABAH' || actor.role === 'GA' || actor.role === 'Sekretaris Direksi';

    const reservation: ServerRoomReservation = {
      id: `rsv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reservation_number: reservationNumber,
      room_id: room.id,
      room_name: room.name,
      room_code: room.code,
      room_location: `${room.building} - ${room.floor}`,
      title: payload.title.trim(),
      description: payload.description?.trim() || '',
      organizer_id: actor.id,
      organizer_name: actor.name,
      organizer_department: actor.department,
      organizer_phone: actor.phone || '-',
      organizer_role: actor.role,
      attendees_count: Number(payload.attendees_count) || 1,
      attendees_list: payload.attendees_list?.trim() || '',
      meeting_type: payload.meeting_type || 'internal',
      priority: payload.priority || (actor.role === 'Sekretaris Direksi' ? 'high' : 'medium'),
      date: payload.date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      start_datetime: `${payload.date}T${payload.start_time}:00`,
      end_datetime: `${payload.date}T${payload.end_time}:00`,
      facilities_requested: Array.isArray(payload.facilities_requested) ? payload.facilities_requested : [],
      consumption_requested: Boolean(payload.consumption_requested),
      consumption_type: payload.consumption_type || 'snack_box',
      consumption_pax: payload.consumption_pax ? Number(payload.consumption_pax) : Number(payload.attendees_count) || 1,
      consumption_serving_time: payload.consumption_serving_time?.trim() || payload.start_time,
      consumption_notes: payload.consumption_notes?.trim() || '',
      documentation_requested: Boolean(payload.documentation_requested),
      documentation_type: payload.documentation_type || 'foto',
      documentation_notes: payload.documentation_notes?.trim() || '',
      status: isAutoApproved ? 'approved' : 'pending_approval',
      approver_id: isAutoApproved ? actor.id : null,
      approver_name: isAutoApproved ? actor.name : null,
      approved_at: isAutoApproved ? new Date().toISOString() : null,
      notes: payload.notes?.trim() || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!db.roomReservations) db.roomReservations = [];
    db.roomReservations.unshift(reservation);

    this.recordAudit(
      'ROOM_RESERVATION_CREATED',
      'MeetingRooms',
      `Reservasi ${reservation.reservation_number} dibuat untuk ${room.name} (${payload.date} ${payload.start_time}-${payload.end_time}) [Prioritas: ${reservation.priority.toUpperCase()}] - Agenda: ${reservation.title}`,
      actor,
      reservation.id
    );

    // Notify GA about pending reservation if submitted by employees
    if (reservation.status === 'pending_approval') {
      this.notify({
        recipient_role: 'GA',
        recipient_division: 'GA',
        title: `Permintaan Reservasi Ruang Rapat: ${room.name}`,
        message: `${actor.name} (${actor.department}) mengajukan pemesanan ${room.name} pada ${payload.date} (${payload.start_time} - ${payload.end_time}).`,
        severity: 'action_required',
        category: 'system',
      });
    }

    // 1. Notify GA / Pantry for Consumption Request
    if (reservation.consumption_requested) {
      this.notify({
        recipient_role: 'GA',
        recipient_division: 'GA',
        title: `Permintaan Konsumsi Pantry: ${room.name}`,
        message: `Pesanan konsumsi (${reservation.consumption_type || 'Snack'} - ${reservation.consumption_pax} Pax) untuk rapat "${reservation.title}" pada ${reservation.date} (${reservation.consumption_serving_time}) oleh ${actor.name} (${actor.department}). Catatan: ${reservation.consumption_notes || '-'}`,
        severity: 'action_required',
        category: 'system',
        link_type: 'asset',
      });
    }

    // 2. Notify Humas for Documentation Request (Photo / Media Coverage)
    // STRICT RULE: Photo & documentation notifications are exclusively for Humas employees
    if (reservation.documentation_requested) {
      this.notify({
        recipient_role: 'Humas',
        title: `Permintaan Dokumentasi Humas: ${room.name}`,
        message: `Permintaan liputan dokumentasi (${reservation.documentation_type || 'Dokumentasi Foto/Video'}) untuk agenda "${reservation.title}" (${reservation.date} ${reservation.start_time}-${reservation.end_time}) oleh ${actor.name} (${actor.department}). Catatan: ${reservation.documentation_notes || '-'}`,
        severity: 'action_required',
        category: 'system',
        link_type: 'asset',
      });
    }

    // 3. Notify IT Support for IT Facilities Request (e.g. Polycom, Smart TV, Laser Projector, HDMI)
    const itKeywords = ['polycom', 'projector', 'proyektor', 'tv', 'hdmi', 'converter', 'video conference', 'vicon', 'zoom', 'camera', 'laptop', 'wifi', 'lan', 'audio visual', 'network'];
    const requestedITFacilities = (reservation.facilities_requested || []).filter(f => {
      const lower = f.toLowerCase();
      return itKeywords.some(kw => lower.includes(kw));
    });

    if (requestedITFacilities.length > 0) {
      this.notify({
        recipient_role: 'IT',
        recipient_division: 'IT',
        title: `Permintaan Fasilitas IT Ruang Rapat: ${room.name}`,
        message: `Permintaan perangkat IT (${requestedITFacilities.join(', ')}) untuk rapat "${reservation.title}" pada ${reservation.date} (${reservation.start_time} - ${reservation.end_time}) oleh ${actor.name} (${actor.department}). Siapkan perangkat & koneksi sebelum rapat.`,
        severity: 'action_required',
        category: 'system',
        link_type: 'asset',
      });
    }

    // 4. Notify GA for GA Facilities / Sarana Tambahan (e.g. Sound System, Mic Wireless, Whiteboard Kaca)
    const gaKeywords = ['sound', 'mic', 'wireless', 'whiteboard', 'spidol', 'kursi', 'meja', 'podium', 'ac', 'kebersihan', 'ruangan', 'tata letak'];
    const requestedGAFacilities = (reservation.facilities_requested || []).filter(f => {
      const lower = f.toLowerCase();
      return gaKeywords.some(kw => lower.includes(kw));
    });

    if (requestedGAFacilities.length > 0) {
      this.notify({
        recipient_role: 'GA',
        recipient_division: 'GA',
        title: `Kebutuhan Sarana GA Ruang Rapat: ${room.name}`,
        message: `Kebutuhan sarana fisik GA (${requestedGAFacilities.join(', ')}) untuk rapat "${reservation.title}" pada ${reservation.date} (${reservation.start_time} - ${reservation.end_time}) oleh ${actor.name} (${actor.department}).`,
        severity: 'info',
        category: 'system',
        link_type: 'asset',
      });
    }

    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));

    return reservation;
  }

  static approveRoomReservation(reservationId: string, actor: ServerUser): ServerRoomReservation {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA') {
      throw new Error('Akses ditolak: Hanya Divisi GA dan Admin GABAH yang berwenang menyetujui reservasi ruang rapat.');
    }

    const reservation = (db.roomReservations || []).find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reservasi tidak ditemukan.');

    // Re-verify no collision before approving
    const conflicting = (db.roomReservations || []).find(r => {
      if (r.id === reservation.id) return false;
      if (r.room_id !== reservation.room_id) return false;
      if (r.date !== reservation.date) return false;
      if (!['approved', 'in_use'].includes(r.status)) return false;
      return reservation.start_time < r.end_time && reservation.end_time > r.start_time;
    });

    if (conflicting) {
      throw new Error(`Tidak dapat disetujui: Tabrakan jadwal dengan reservasi ${conflicting.reservation_number} (${conflicting.organizer_name}).`);
    }

    reservation.status = 'approved';
    reservation.approver_id = actor.id;
    reservation.approver_name = actor.name;
    reservation.approved_at = new Date().toISOString();
    reservation.updated_at = new Date().toISOString();

    this.recordAudit(
      'ROOM_RESERVATION_APPROVED',
      'MeetingRooms',
      `Reservasi ${reservation.reservation_number} disetujui untuk ${reservation.room_name}`,
      actor,
      reservation.id
    );

    this.notify({
      recipient_user_id: reservation.organizer_id,
      title: `Reservasi Disetujui: ${reservation.room_name}`,
      message: `Permintaan reservasi ruang rapat "${reservation.title}" pada ${reservation.date} (${reservation.start_time} - ${reservation.end_time}) telah disetujui oleh GA.`,
      severity: 'success',
      category: 'system',
    });

    // Notify Humas team if photography/documentation was requested (Humas only)
    if (reservation.documentation_requested) {
      this.notify({
        recipient_role: 'Humas',
        title: `Jadwal Liputan Foto Disetujui: ${reservation.room_name}`,
        message: `Rapat "${reservation.title}" pada ${reservation.date} (${reservation.start_time} - ${reservation.end_time}) di ${reservation.room_name} telah disetujui GA. Tim Humas dapat bersiap untuk dokumentasi foto kegiatan.`,
        severity: 'action_required',
        category: 'system',
        link_type: 'asset',
      });
    }

    // Notify IT Support if IT facilities were requested upon approval
    const itKeywords = ['polycom', 'projector', 'proyektor', 'tv', 'hdmi', 'converter', 'video conference', 'vicon', 'zoom', 'camera', 'laptop', 'wifi', 'lan', 'audio visual', 'network'];
    const approvedITFacilities = (reservation.facilities_requested || []).filter(f => {
      const lower = f.toLowerCase();
      return itKeywords.some(kw => lower.includes(kw));
    });

    if (approvedITFacilities.length > 0) {
      this.notify({
        recipient_role: 'IT',
        recipient_division: 'IT',
        title: `Penyiapan IT Disetujui: ${reservation.room_name}`,
        message: `Reservasi rapat "${reservation.title}" pada ${reservation.date} (${reservation.start_time} - ${reservation.end_time}) telah disetujui GA. Mohon siapkan perangkat IT: ${approvedITFacilities.join(', ')}.`,
        severity: 'action_required',
        category: 'system',
        link_type: 'asset',
      });
    }

    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));

    return reservation;
  }

  static rejectRoomReservation(reservationId: string, reason: string, actor: ServerUser): ServerRoomReservation {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA') {
      throw new Error('Akses ditolak: Hanya Divisi GA dan Admin GABAH yang berwenang menolak reservasi ruang rapat.');
    }

    const reservation = (db.roomReservations || []).find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reservasi tidak ditemukan.');

    reservation.status = 'rejected';
    reservation.rejection_reason = reason || 'Kapasitas penuh / prioritas rapat direksi';
    reservation.approver_id = actor.id;
    reservation.approver_name = actor.name;
    reservation.updated_at = new Date().toISOString();

    this.recordAudit(
      'ROOM_RESERVATION_REJECTED',
      'MeetingRooms',
      `Reservasi ${reservation.reservation_number} ditolak: ${reservation.rejection_reason}`,
      actor,
      reservation.id
    );

    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));

    return reservation;
  }

  static checkinRoomReservation(reservationId: string, actor: ServerUser): ServerRoomReservation {
    const reservation = (db.roomReservations || []).find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reservasi tidak ditemukan.');

    reservation.status = 'in_use';
    reservation.checkin_at = new Date().toISOString();
    reservation.updated_at = new Date().toISOString();

    const room = (db.rooms || []).find(r => r.id === reservation.room_id);
    if (room) {
      room.status = 'in_use';
    }

    this.recordAudit('ROOM_CHECKIN', 'MeetingRooms', `Check-in rapat ${reservation.reservation_number} di ${reservation.room_name}`, actor, reservation.id);
    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));
    return reservation;
  }

  static checkoutRoomReservation(reservationId: string, actor: ServerUser): ServerRoomReservation {
    const reservation = (db.roomReservations || []).find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reservasi tidak ditemukan.');

    reservation.status = 'completed';
    reservation.checkout_at = new Date().toISOString();
    reservation.updated_at = new Date().toISOString();

    const room = (db.rooms || []).find(r => r.id === reservation.room_id);
    if (room) {
      room.status = 'available';
    }

    this.recordAudit('ROOM_CHECKOUT', 'MeetingRooms', `Check-out selesai rapat ${reservation.reservation_number} di ${reservation.room_name}`, actor, reservation.id);
    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));
    return reservation;
  }

  static cancelRoomReservation(reservationId: string, actor: ServerUser): ServerRoomReservation {
    const reservation = (db.roomReservations || []).find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reservasi tidak ditemukan.');

    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA' && reservation.organizer_id !== actor.id) {
      throw new Error('Akses ditolak: Anda hanya dapat membatalkan reservasi yang Anda buat sendiri.');
    }

    reservation.status = 'cancelled';
    reservation.updated_at = new Date().toISOString();

    const room = (db.rooms || []).find(r => r.id === reservation.room_id);
    if (room && room.status === 'in_use') {
      room.status = 'available';
    }

    this.recordAudit('ROOM_RESERVATION_CANCELLED', 'MeetingRooms', `Pembatalan reservasi ${reservation.reservation_number} di ${reservation.room_name}`, actor, reservation.id);
    persistDataStore().catch(err => console.warn('[GABAH Reservation] Persistence notice:', err.message));
    return reservation;
  }

  static updateMeetingRoom(roomId: string, updates: Partial<ServerMeetingRoom>, actor: ServerUser): ServerMeetingRoom {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA') {
      throw new Error('Akses ditolak: Hanya GA dan Admin GABAH yang berwenang mengubah status ruangan.');
    }

    const room = (db.rooms || []).find(r => r.id === roomId);
    if (!room) throw new Error('Ruangan tidak ditemukan.');

    // SECURITY (CR-06): explicit allowlist — no Object.assign / mass assignment.
    // Protected server-owned fields: id, code, building, floor (identity &
    // location integrity), pic_ga (PIC ditetapkan admin/GA via proses resmi).
    const allowedRoomFields: Array<keyof ServerMeetingRoom> = [
      'name', 'capacity', 'facilities', 'status', 'color', 'description', 'image_url',
    ];
    for (const key of allowedRoomFields) {
      if (updates[key] !== undefined) {
        (room as any)[key] = updates[key];
      }
    }
    this.recordAudit('ROOM_UPDATED', 'MeetingRooms', `Update fasilitas/status ruangan ${room.name}`, actor, room.id);
    persistDataStore().catch(err => console.warn('[GABAH Room] Persistence notice:', err.message));
    return room;
  }

  // Meeting Types CRUD (Admin GABAH)
  static getMeetingTypes(): ServerMeetingType[] {
    return db.meetingTypes || [];
  }

  static createMeetingType(payload: Partial<ServerMeetingType>, actor: ServerUser): ServerMeetingType {
    if (actor.role !== 'Admin GABAH') {
      throw new Error('Akses ditolak: Hanya Admin GABAH yang berwenang menambah tipe rapat.');
    }
    if (!payload.name || !payload.name.trim()) throw new Error('Nama tipe rapat wajib diisi.');
    const newItem: ServerMeetingType = {
      id: `MT-${Date.now()}`,
      name: payload.name.trim(),
      code: payload.code ? payload.code.trim().toLowerCase() : payload.name.trim().toLowerCase().replace(/\s+/g, '_'),
      description: payload.description?.trim() || '',
      priority_level: payload.priority_level || 'medium',
      color: payload.color || 'blue',
      is_system: false,
    };
    if (!db.meetingTypes) db.meetingTypes = [];
    db.meetingTypes.push(newItem);
    this.recordAudit('MEETING_TYPE_CREATED', 'MeetingRooms', `Menambah tipe rapat baru: ${newItem.name}`, actor, newItem.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return newItem;
  }

  static updateMeetingType(id: string, payload: Partial<ServerMeetingType>, actor: ServerUser): ServerMeetingType {
    if (actor.role !== 'Admin GABAH') {
      throw new Error('Akses ditolak: Hanya Admin GABAH yang berwenang mengubah tipe rapat.');
    }
    const item = (db.meetingTypes || []).find(m => m.id === id);
    if (!item) throw new Error('Tipe rapat tidak ditemukan.');
    if (payload.name) item.name = payload.name.trim();
    if (payload.code) item.code = payload.code.trim().toLowerCase();
    if (payload.description !== undefined) item.description = payload.description.trim();
    if (payload.priority_level) item.priority_level = payload.priority_level;
    if (payload.color) item.color = payload.color;
    this.recordAudit('MEETING_TYPE_UPDATED', 'MeetingRooms', `Mengubah tipe rapat: ${item.name}`, actor, item.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return item;
  }

  static deleteMeetingType(id: string, actor: ServerUser): { success: boolean } {
    if (actor.role !== 'Admin GABAH') {
      throw new Error('Akses ditolak: Hanya Admin GABAH yang berwenang menghapus tipe rapat.');
    }
    const idx = (db.meetingTypes || []).findIndex(m => m.id === id);
    if (idx === -1) throw new Error('Tipe rapat tidak ditemukan.');
    const removed = db.meetingTypes[idx];
    db.meetingTypes.splice(idx, 1);
    this.recordAudit('MEETING_TYPE_DELETED', 'MeetingRooms', `Menghapus tipe rapat: ${removed.name}`, actor, removed.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return { success: true };
  }

  // Meeting Facilities CRUD (Admin GABAH, GA, IT)
  static getMeetingFacilities(): ServerMeetingFacility[] {
    return db.meetingFacilities || [];
  }

  static createMeetingFacility(payload: Partial<ServerMeetingFacility>, actor: ServerUser): ServerMeetingFacility {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA' && actor.role !== 'IT') {
      throw new Error('Akses ditolak: Hanya Admin GABAH, GA, atau IT yang berwenang menambah fasilitas.');
    }
    if (!payload.name || !payload.name.trim()) throw new Error('Nama fasilitas wajib diisi.');
    const newFac: ServerMeetingFacility = {
      id: `FAC-${payload.category || 'GA'}-${Date.now()}`,
      name: payload.name.trim(),
      category: payload.category === 'IT' ? 'IT' : 'GA',
      description: payload.description?.trim() || '',
      is_active: payload.is_active !== undefined ? payload.is_active : true,
      is_system: false,
    };
    if (!db.meetingFacilities) db.meetingFacilities = [];
    db.meetingFacilities.push(newFac);
    this.recordAudit('MEETING_FACILITY_CREATED', 'MeetingRooms', `Menambah fasilitas rapat [${newFac.category}]: ${newFac.name}`, actor, newFac.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return newFac;
  }

  static updateMeetingFacility(id: string, payload: Partial<ServerMeetingFacility>, actor: ServerUser): ServerMeetingFacility {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA' && actor.role !== 'IT') {
      throw new Error('Akses ditolak: Hanya Admin GABAH, GA, atau IT yang berwenang mengubah fasilitas.');
    }
    const item = (db.meetingFacilities || []).find(f => f.id === id);
    if (!item) throw new Error('Fasilitas tidak ditemukan.');
    if (payload.name) item.name = payload.name.trim();
    if (payload.category) item.category = payload.category;
    if (payload.description !== undefined) item.description = payload.description.trim();
    if (payload.is_active !== undefined) item.is_active = payload.is_active;
    this.recordAudit('MEETING_FACILITY_UPDATED', 'MeetingRooms', `Mengubah fasilitas rapat [${item.category}]: ${item.name}`, actor, item.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return item;
  }

  static deleteMeetingFacility(id: string, actor: ServerUser): { success: boolean } {
    if (actor.role !== 'Admin GABAH' && actor.role !== 'GA' && actor.role !== 'IT') {
      throw new Error('Akses ditolak: Hanya Admin GABAH, GA, atau IT yang berwenang menghapus fasilitas.');
    }
    const idx = (db.meetingFacilities || []).findIndex(f => f.id === id);
    if (idx === -1) throw new Error('Fasilitas tidak ditemukan.');
    const removed = db.meetingFacilities[idx];
    db.meetingFacilities.splice(idx, 1);
    this.recordAudit('MEETING_FACILITY_DELETED', 'MeetingRooms', `Menghapus fasilitas rapat [${removed.category}]: ${removed.name}`, actor, removed.id);
    persistDataStore().catch(err => console.warn('[GABAH Persistence] notice:', err.message));
    return { success: true };
  }
}
