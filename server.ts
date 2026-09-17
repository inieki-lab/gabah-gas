import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, seedInitialData, ServerUser } from './server/db';
import { CANONICAL_TAXONOMY, resolveTaxonomyByHumanName } from './server/taxonomy';
import { AssetNumberingEngine } from './server/numbering';
import { GabahDomainService } from './server/services';
import { initializePersistence, persistDataStore } from './server/persistence';
import { gabahSecurityMiddleware, actorFor } from './server/runtime-hardening';
import {
  createSession,
  destroySession,
  extractToken,
  hashPassword,
  verifyPassword,
  isLoginLocked,
  recordFailedLogin,
  clearFailedLogins,
  sanitizeUser,
} from './server/auth';

// Initialize seed data
seedInitialData();

async function startServer() {
  await initializePersistence();
  AssetNumberingEngine.syncFromExistingRecords({ tickets: db.tickets, loans: db.loans });

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Production API security and session/role hardening
  app.use(gabahSecurityMiddleware);

  // Persist every successful state-changing API request after the response is sent
  app.use((req, res, next) => {
    if (req.method === 'GET' || !req.path.startsWith('/api/')) return next();
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void persistDataStore();
      }
    });
    next();
  });

  // Helper to extract authenticated user from verified request context
  const getActor = (req: express.Request): ServerUser => {
    const verified = (req as any).user || actorFor(req);
    if (verified) return verified;
    throw new Error('Pengguna tidak terautentikasi.');
  };

  // ==========================================
  // API ROUTES (FIRST)
  // ==========================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'GABAH (General Asset & Business Administration Hub)',
      version: '2026.1.0-enterprise',
      organization: 'PT Food Station Tjipinang Jaya (BUMD DKI Jakarta)',
    });
  });

  // Auth / Users
  app.get('/api/users', (req, res) => {
    res.json({ success: true, data: db.users.map(u => sanitizeUser(u)) });
  });

  app.post('/api/users', (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role !== 'Admin GABAH' && (actor as any).role !== 'Superadmin') {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menambah pengguna.' });
      }
      const { name, email, role, division, department, password, temp_password, phone } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi' });
      }
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain' });
      }

      const roleLabels: Record<string, string> = {
        'Admin GABAH': 'Super Admin',
        'Superadmin': 'Super Admin',
        'IT': 'IT Technical Support',
        'GA': 'Fasilitas & Gedung',
        'Supply Chain': 'Logistik Beras',
        'PIBC': 'Pengawas Pasar PIBC',
        'Auditor': 'Internal Auditor',
        'Karyawan': 'Pegawai Operasional'
      };

      const plainPassword = password || temp_password || 'Pangan2026!';
      const { hash, salt } = hashPassword(plainPassword);

      const newUser: ServerUser = {
        id: `USR-${Date.now().toString().slice(-6)}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || 'Karyawan',
        role_label: roleLabels[role] || 'Pegawai Operasional',
        division: division || 'Umum',
        department: department || 'Operasional',
        phone: phone || '',
        avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        is_active: true,
        password_hash: hash,
        password_salt: salt,
      };

      db.users.unshift(newUser);
      GabahDomainService.recordAudit(
        'USER_CREATED',
        'Users',
        `Menambahkan pengguna baru: ${newUser.name} (${newUser.email}) - Peran: ${newUser.role}`,
        actor,
        newUser.id
      );

      res.status(201).json({ success: true, data: sanitizeUser(newUser) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/users/:id', (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role !== 'Admin GABAH' && (actor as any).role !== 'Superadmin') {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mengubah akun pengguna.' });
      }

      const targetUser = db.users.find(u => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      }

      const { name, role, division, department, is_active, password, temp_password, phone } = req.body;
      if (name !== undefined) targetUser.name = name.trim();
      if (role !== undefined) targetUser.role = role;
      if (division !== undefined) targetUser.division = division;
      if (department !== undefined) targetUser.department = department;
      if (is_active !== undefined) targetUser.is_active = Boolean(is_active);
      if (phone !== undefined) targetUser.phone = phone;

      if (password || temp_password) {
        const plain = password || temp_password;
        const { hash, salt } = hashPassword(plain);
        targetUser.password_hash = hash;
        targetUser.password_salt = salt;
        delete targetUser.temp_password;
      }

      GabahDomainService.recordAudit(
        'USER_UPDATED',
        'Users',
        `Memperbarui profil pengguna ${targetUser.name} (${targetUser.email})`,
        actor,
        targetUser.id
      );

      res.json({ success: true, data: sanitizeUser(targetUser) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role !== 'Admin GABAH' && (actor as any).role !== 'Superadmin') {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menghapus pengguna.' });
      }

      const targetId = req.params.id;

      // Cannot delete current active user
      if (targetId === actor.id) {
        return res.status(400).json({
          success: false,
          message: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.'
        });
      }

      const userIndex = db.users.findIndex(u => u.id === targetId);
      if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      const targetUser = db.users[userIndex];

      // Check if user has active borrowed loans
      const activeLoans = db.loans.filter(
        l => l.borrower_id === targetId && ['pending_approval', 'approved', 'borrowed'].includes(l.status)
      );
      if (activeLoans.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Pengguna tidak dapat dihapus karena masih memiliki ${activeLoans.length} transaksi peminjaman aktif. Harap kembalikan aset terlebih dahulu.`
        });
      }

      // Check if user has assigned assets
      const assignedAssets = db.assets.filter(
        a => a.assigned_to?.id === targetId && a.status === 'assigned'
      );
      if (assignedAssets.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Pengguna tidak dapat dihapus karena masih memegang ${assignedAssets.length} aset tetap (${assignedAssets.map(a => a.asset_number).slice(0, 2).join(', ')}). Harap tarik atau re-assign aset terlebih dahulu.`
        });
      }

      // Perform deletion
      db.users.splice(userIndex, 1);

      GabahDomainService.recordAudit(
        'USER_DELETED',
        'Users',
        `Menghapus akun pengguna: ${targetUser.name} (${targetUser.email}, ${targetUser.role})`,
        actor,
        targetId
      );

      res.json({ success: true, message: `Pengguna ${targetUser.name} berhasil dihapus.` });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Secure Authentication Endpoints
  app.post('/api/auth/login', (req, res) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const lockCheck = isLoginLocked(ip);
      if (lockCheck.isLocked) {
        return res.status(429).json({
          success: false,
          message: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${lockCheck.remainingLockoutSeconds} detik.`,
        });
      }

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const inputEmail = email.trim().toLowerCase();
      const user = db.users.find(u => {
        const uEmail = u.email.toLowerCase().trim();
        if (uEmail === inputEmail) return true;
        const uPrefix = uEmail.split('@')[0];
        const inPrefix = inputEmail.split('@')[0];
        return uPrefix === inPrefix;
      });
      if (!user || !user.is_active) {
        const lock = recordFailedLogin(ip);
        if (lock.isLocked) {
          return res.status(429).json({
            success: false,
            message: `Terlalu banyak percobaan login gagal. IP dikunci selama ${lock.remainingLockoutSeconds} detik.`,
          });
        }
        return res.status(401).json({ success: false, message: 'Email atau kata sandi tidak valid.' });
      }

      // Verify password via constant-time PBKDF2 check
      let isValidPassword = false;
      if (user.password_hash && user.password_salt) {
        isValidPassword = verifyPassword(password, user.password_hash, user.password_salt);
      } else if (user.temp_password && user.temp_password === password) {
        // Upgrade legacy plaintext to secure PBKDF2 hash immediately
        const { hash, salt } = hashPassword(password);
        user.password_hash = hash;
        user.password_salt = salt;
        delete user.temp_password;
        isValidPassword = true;
      }

      if (!isValidPassword) {
        const lock = recordFailedLogin(ip);
        GabahDomainService.recordAudit(
          'AUTH_LOGIN_FAILED',
          'Auth',
          `Gagal login untuk pengguna ${user.name} (${user.email}) - Kata sandi tidak cocok`,
          user
        );
        if (lock.isLocked) {
          return res.status(429).json({
            success: false,
            message: `Terlalu banyak percobaan login gagal. IP dikunci selama ${lock.remainingLockoutSeconds} detik.`,
          });
        }
        return res.status(401).json({ success: false, message: 'Email atau kata sandi tidak valid.' });
      }

      // Reset lockout counter on success
      clearFailedLogins(ip);

      // Create persistent session
      const session = createSession(user.id, req);
      GabahDomainService.recordAudit(
        'AUTH_LOGIN_SUCCESS',
        'Auth',
        `Pengguna ${user.name} (${user.role}) berhasil masuk dari IP ${session.ip_address}`,
        user
      );

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token: session.token,
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const token = extractToken(req);
      if (token) {
        destroySession(token);
      }
      res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const actor = getActor(req);
      res.json({ success: true, data: sanitizeUser(actor) });
    } catch {
      res.status(401).json({ success: false, message: 'Sesi pengguna tidak valid.' });
    }
  });

  app.post('/api/auth/switch-role', (req, res) => {
    try {
      const actor = getActor(req);
      // Strictly prevent unauthorized users from switching roles
      if (actor.role !== 'Admin GABAH' && (actor as any).role !== 'Superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Hanya Administrator yang berwenang melakukan simulasi role (RBAC switcher).',
        });
      }

      const { userId } = req.body;
      const targetUser = db.users.find(u => u.id === userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
      }

      // Create legitimate session for target persona
      const session = createSession(targetUser.id, req);
      GabahDomainService.recordAudit(
        'AUTH_SWITCH_ROLE',
        'Auth',
        `Admin ${actor.name} berpindah simulasi ke role ${targetUser.name} (${targetUser.role})`,
        actor,
        targetUser.id
      );

      res.json({
        success: true,
        data: {
          user: sanitizeUser(targetUser),
          token: session.token,
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Master Taxonomy
  app.get('/api/taxonomy/categories', (req, res) => {
    res.json({ success: true, data: CANONICAL_TAXONOMY });
  });

  app.post('/api/taxonomy/resolve', (req, res) => {
    try {
      const { nameOrCode } = req.body;
      const resolved = resolveTaxonomyByHumanName(nameOrCode);
      res.json({ success: true, data: resolved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Assets Management
  app.get('/api/assets', (req, res) => {
    const actor = getActor(req);
    const scopedAssets = GabahDomainService.getScopedAssets(actor);
    res.json({ success: true, data: scopedAssets });
  });

  app.post('/api/assets', (req, res) => {
    try {
      const actor = getActor(req);
      const newAsset = GabahDomainService.createAsset(req.body, actor);
      res.status(201).json({ success: true, data: newAsset });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/assets/:id', (req, res) => {
    const asset = db.assets.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
    res.json({ success: true, data: asset });
  });

  app.patch('/api/assets/:id', (req, res) => {
    const actor = getActor(req);
    const asset = db.assets.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

    // Update mutable fields (not asset_number or owner_division)
    const allowed = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'corporate_asset_number'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (asset as any)[key] = req.body[key];
      }
    }
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('ASSET_UPDATED', 'Assets', `Memperbarui informasi aset ${asset.asset_number}`, actor, asset.id);

    res.json({ success: true, data: asset });
  });

  app.post('/api/assets/:id/assign', (req, res) => {
    try {
      const actor = getActor(req);
      const { targetUserId, reason } = req.body;
      const updated = GabahDomainService.assignAsset(req.params.id, targetUserId, reason, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/move', (req, res) => {
    try {
      const actor = getActor(req);
      const { newLocation, reason } = req.body;
      const updated = GabahDomainService.moveAsset(req.params.id, newLocation, reason, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/lifecycle', (req, res) => {
    try {
      const actor = getActor(req);
      const { action, notes } = req.body;
      const updated = GabahDomainService.mutateLifecycle(req.params.id, action, notes, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Movements
  app.get('/api/movements', (req, res) => {
    const { assetId } = req.query;
    if (assetId) {
      const filtered = db.movements.filter(m => m.asset_id === assetId);
      return res.json({ success: true, data: filtered });
    }
    res.json({ success: true, data: db.movements });
  });

  // Loans
  app.get('/api/loans', (req, res) => {
    const actor = getActor(req);
    // Scoping loans:
    if (['Admin GABAH', 'Management', 'Auditor'].includes(actor.role)) {
      return res.json({ success: true, data: db.loans });
    }
    if (actor.role === 'Karyawan') {
      return res.json({ success: true, data: db.loans.filter(l => l.borrower_id === actor.id) });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'IT') });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'GA') });
    }
    if (actor.role === 'Supply Chain') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'SC') });
    }
    res.json({ success: true, data: db.loans });
  });

  app.post('/api/loans', (req, res) => {
    try {
      const actor = getActor(req);
      const newLoan = GabahDomainService.requestLoan(req.body, actor);
      res.status(201).json({ success: true, data: newLoan });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/approve', (req, res) => {
    try {
      const actor = getActor(req);
      const approved = GabahDomainService.approveLoan(req.params.id, actor);
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/handover', (req, res) => {
    try {
      const actor = getActor(req);
      const { handoverNotes } = req.body;
      const handedOver = GabahDomainService.handoverLoan(req.params.id, handoverNotes, actor);
      res.json({ success: true, data: handedOver });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/return', (req, res) => {
    try {
      const actor = getActor(req);
      const { condition, returnNotes } = req.body;
      const returned = GabahDomainService.returnLoan(req.params.id, condition, returnNotes, actor);
      res.json({ success: true, data: returned });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Helpdesk Tickets
  app.get('/api/tickets', (req, res) => {
    const actor = getActor(req);
    if (['Admin GABAH', 'Management', 'Auditor'].includes(actor.role)) {
      return res.json({ success: true, data: db.tickets });
    }
    if (actor.role === 'Karyawan') {
      return res.json({ success: true, data: db.tickets.filter(t => t.reporter_id === actor.id) });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.tickets.filter(t => t.category === 'IT' || t.category === 'License') });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.tickets.filter(t => t.category === 'GA') });
    }
    if (actor.role === 'Supply Chain') {
      return res.json({ success: true, data: db.tickets.filter(t => t.category === 'SC') });
    }
    res.json({ success: true, data: db.tickets });
  });

  app.post('/api/tickets', (req, res) => {
    try {
      const actor = getActor(req);
      const newTicket = GabahDomainService.createTicket(req.body, actor);
      res.status(201).json({ success: true, data: newTicket });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/tickets/:id/status', (req, res) => {
    const actor = getActor(req);
    const ticket = db.tickets.find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

    const { status, resolutionNotes } = req.body;
    ticket.status = status;
    if (resolutionNotes) ticket.resolution_notes = resolutionNotes;
    if (status === 'resolved' || status === 'closed') {
      ticket.resolved_at = new Date().toISOString();
    }
    ticket.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('TICKET_STATUS_UPDATED', 'Tickets', `Mengubah status tiket ${ticket.ticket_number} menjadi ${status}`, actor, ticket.id);

    res.json({ success: true, data: ticket });
  });

  // Maintenance & Calibration Schedules
  app.get('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    if (['Admin GABAH', 'Management', 'Auditor'].includes(actor.role)) {
      return res.json({ success: true, data: db.maintenances });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'IT' || m.category_type === 'IT') });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'GA' || m.category_type === 'GA' || m.category_type === 'General') });
    }
    if (actor.role === 'Supply Chain') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'SC' || m.owner_division === 'Supply Chain') });
    }
    res.json({ success: true, data: db.maintenances });
  });

  app.post('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    const count = db.maintenances.length + 1;
    const scheduleCode = `MNT-2026-${String(count).padStart(3, '0')}`;
    const newSchedule = {
      id: `mnt-${Date.now()}`,
      schedule_code: scheduleCode,
      title: req.body.title || 'Jadwal Pemeliharaan',
      asset_id: req.body.asset_id,
      asset_name: req.body.asset_name,
      asset_number: req.body.asset_number,
      category_type: req.body.category_type || 'General',
      owner_division: req.body.owner_division || actor.division,
      scheduled_date: req.body.scheduled_date || new Date().toISOString().split('T')[0],
      frequency: req.body.frequency || 'one_time',
      status: req.body.status || 'scheduled',
      technician_name: req.body.technician_name || 'Tim Internal',
      vendor_id: req.body.vendor_id,
      vendor_name: req.body.vendor_name,
      estimated_cost: req.body.estimated_cost || 0,
      actual_cost: req.body.actual_cost || 0,
      notes: req.body.notes || '',
      checklist: req.body.checklist || [],
      created_at: new Date().toISOString(),
    };
    db.maintenances.push(newSchedule);
    GabahDomainService.recordAudit('MAINTENANCE_SCHEDULED', 'Maintenance', `Menambahkan jadwal servis ${scheduleCode} untuk ${newSchedule.asset_name}`, actor, newSchedule.id);
    res.status(201).json({ success: true, data: newSchedule });
  });

  app.patch('/api/maintenances/:id', (req, res) => {
    const actor = getActor(req);
    const schedule = db.maintenances.find(m => m.id === req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Jadwal servis tidak ditemukan' });

    Object.assign(schedule, req.body);
    if (req.body.status === 'completed') {
      schedule.last_completed_at = new Date().toISOString();
    }
    GabahDomainService.recordAudit('MAINTENANCE_UPDATED', 'Maintenance', `Memperbarui jadwal servis ${schedule.schedule_code} status: ${schedule.status}`, actor, schedule.id);
    res.json({ success: true, data: schedule });
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    const actor = getActor(req);
    const filtered = db.notifications.filter(n => {
      if (actor.role === 'Admin GABAH') return true;
      if (n.recipient_user_id && n.recipient_user_id === actor.id) return true;
      if (n.recipient_role && n.recipient_role === actor.role) return true;
      if (n.recipient_division && n.recipient_division === actor.division) return true;
      return false;
    });
    res.json({ success: true, data: filtered });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    const notif = db.notifications.find(n => n.id === req.params.id);
    if (notif) notif.is_read = true;
    res.json({ success: true, data: notif });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const actor = getActor(req);
    for (const n of db.notifications) {
      if (actor.role === 'Admin GABAH' || n.recipient_role === actor.role || n.recipient_user_id === actor.id) {
        n.is_read = true;
      }
    }
    res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
  });

  // Dashboard Stats & Attention Center
  app.get('/api/dashboard/stats', (req, res) => {
    const actor = getActor(req);
    const assets = GabahDomainService.getScopedAssets(actor);
    const totalAssets = assets.length;
    const activeAssets = assets.filter(a => ['active', 'assigned'].includes(a.status)).length;
    const loanableAssets = assets.filter(a => a.is_loanable && a.status === 'available').length;
    const inRepairAssets = assets.filter(a => a.status === 'in_repair').length;

    const activeLoans = db.loans.filter(l => l.status === 'borrowed').length;
    const pendingLoans = db.loans.filter(l => l.status === 'pending_approval').length;

    const openTickets = db.tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;

    res.json({
      success: true,
      data: {
        total_assets: totalAssets,
        active_assets: activeAssets,
        loanable_available: loanableAssets,
        in_repair: inRepairAssets,
        active_loans: activeLoans,
        pending_loans: pendingLoans,
        open_tickets: openTickets,
      },
    });
  });

  app.get('/api/dashboard/attention', (req, res) => {
    const actor = getActor(req);
    const items = GabahDomainService.getAttentionCenter(actor);
    res.json({ success: true, data: items });
  });

  // Accurate ERP Reconciliation
  app.get('/api/reconciliation', (req, res) => {
    const reconData = GabahDomainService.getReconciliationData();
    res.json({ success: true, data: reconData });
  });

  app.post('/api/reconciliation/link', (req, res) => {
    const actor = getActor(req);
    const { assetId, corporateAssetNumber } = req.body;
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

    asset.corporate_asset_number = corporateAssetNumber ? corporateAssetNumber.trim() : null;
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('RECONCILIATION_LINK', 'Assets', `Menautkan nomor aset Accurate "${corporateAssetNumber}" ke ${asset.asset_number}`, actor, asset.id);

    res.json({ success: true, data: asset });
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    res.json({ success: true, data: db.auditLogs });
  });

  // ==========================================
  // VITE MIDDLEWARE (DEVELOPMENT vs PRODUCTION)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GABAH Enterprise Engine] Running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start GABAH server:', err);
  process.exit(1);
});
