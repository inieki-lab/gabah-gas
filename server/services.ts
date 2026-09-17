import { db, ServerAsset, ServerLoan, ServerTicket, ServerAssetMovement, ServerNotification, ServerAuditLog, ServerUser } from './db';
import { CANONICAL_TAXONOMY, resolveTaxonomyByHumanName } from './taxonomy';
import { AssetNumberingEngine } from './numbering';

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
    if (['Admin GABAH', 'Management', 'Auditor'].includes(user.role)) {
      return db.assets;
    }

    // Karyawan can only view assigned assets or loanable pool assets
    if (user.role === 'Karyawan') {
      return db.assets.filter(a => a.assigned_to?.id === user.id || a.is_loanable);
    }

    // Vendor only sees vendor related
    if ((user.role as string) === 'Vendor') {
      return db.assets.filter(a => a.license_detail?.vendor?.toLowerCase().includes('mitranet'));
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
    category_name_or_code: string;
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
    const taxonomy = resolveTaxonomyByHumanName(payload.category_name_or_code, payload.owner_division);

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
    if (!['Admin GABAH', 'Management'].includes(actor.role)) {
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

    // Corporate Security Rule: All IT assets belong to IT. GA only has read-only access.
    if (asset.owner_division === 'IT' && actor.role === 'GA') {
      throw new Error('Semua barang IT adalah milik Divisi IT. Divisi GA hanya memiliki izin lihat (read-only) dan tidak berwenang menugaskan aset ini.');
    }

    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) throw new Error('User penerima tidak ditemukan');

    const previousUser = asset.assigned_to?.name || 'Gudang / Pool';

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
        if (!['Admin GABAH', 'Management'].includes(actor.role)) {
          throw new Error('Hanya Admin GABAH atau Management yang berwenang menyetujui penghapusan aset.');
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

    // Authoritative Collision Check: StartA < DueB && DueA > StartB
    const conflicting = db.loans.find(l => {
      if (l.asset_id !== asset.id) return false;
      if (!['pending_approval', 'approved', 'borrowed'].includes(l.status)) return false;

      const existingStart = new Date(l.start_date).getTime();
      const existingDue = new Date(l.due_date).getTime();

      return start < existingDue && due > existingStart;
    });

    if (conflicting) {
      throw new Error(`Tabrakan Jadwal! Aset "${asset.name}" (${asset.asset_number}) sudah dipinjam / direservasi pada periode tersebut (${conflicting.start_date.split('T')[0]} s/d ${conflicting.due_date.split('T')[0]}).`);
    }

    const borrower = db.users.find(u => u.id === payload.borrower_id) || actor;

    const loanNumber = AssetNumberingEngine.generateLoanNumber();
    const newLoan: ServerLoan = {
      id: `LOAN-${Date.now()}`,
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
      message: `${borrower.name} (${borrower.department}) mengajukan pinjaman ${asset.name} (${asset.asset_number}).`,
      severity: 'action_required',
      category: 'loan',
      link_type: 'loan',
      link_id: newLoan.id,
    });

    this.recordAudit('LOAN_REQUESTED', 'Loans', `Mengajukan pinjaman ${loanNumber} untuk aset ${asset.asset_number}`, actor, newLoan.id);

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
        throw new Error('Hanya Divisi IT yang berwenang menyetujui peminjaman aset IT.');
      }
      if (loan.owner_division === 'GA' && actor.role !== 'GA') {
        throw new Error('Hanya Divisi GA yang berwenang menyetujui peminjaman aset GA.');
      }
      if (loan.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        throw new Error('Hanya Divisi Supply Chain yang berwenang menyetujui peminjaman aset SC.');
      }
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

    this.recordAudit('LOAN_APPROVED', 'Loans', `Menyetujui pinjaman ${loan.loan_number} untuk ${loan.borrower_name}`, actor, loan.id);

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
    category: 'IT' | 'GA' | 'SC' | 'PIBC' | 'License' | 'General';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    related_asset_id?: string;
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

    // Notify respective division
    const targetDivision = payload.category === 'IT' || payload.category === 'License' ? 'IT' : payload.category === 'GA' ? 'GA' : payload.category === 'SC' ? 'SC' : 'IT';
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
}
