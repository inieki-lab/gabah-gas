import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, seedInitialData, ServerUser, ServerSession } from './server/db';
import { CANONICAL_TAXONOMY, resolveTaxonomyByHumanName } from './server/taxonomy';
import { AssetNumberingEngine } from './server/numbering';
import { GabahDomainService } from './server/services';
import { initializePersistence, persistDataStore } from './server/persistence';
import { gabahSecurityMiddleware, actorFor } from './server/runtime-hardening';
import {
  createSession,
  destroySession,
  destroyAllUserSessions,
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

  app.post('/api/users', async (req, res) => {
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

      // Generate a secure, unpredictable temporary password if none is provided
      const secureRandomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      const generatedTempPassword = `FS-${secureRandomSuffix}!`;
      const plainPassword = password || temp_password || generatedTempPassword;
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
        temp_password: (!password && !temp_password) ? plainPassword : temp_password,
      };

      db.users.unshift(newUser);
      GabahDomainService.recordAudit(
        'USER_CREATED',
        'Users',
        `Menambahkan pengguna baru: ${newUser.name} (${newUser.email}) - Peran: ${newUser.role}`,
        actor,
        newUser.id
      );

      await persistDataStore();

      res.status(201).json({
        success: true,
        data: {
          ...sanitizeUser(newUser),
          temp_password: plainPassword,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role !== 'Admin GABAH' && (actor as any).role !== 'Superadmin') {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mengubah akun pengguna.' });
      }

      const targetUser = db.users.find(u => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      }

      const { name, email, role, division, department, is_active, password, temp_password, phone } = req.body;
      if (name !== undefined) targetUser.name = name.trim();
      if (email !== undefined && email.trim()) {
        const trimmedEmail = email.trim().toLowerCase();
        if (db.users.some(u => u.id !== targetUser.id && u.email.toLowerCase().trim() === trimmedEmail)) {
          return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain.' });
        }
        targetUser.email = trimmedEmail;
      }
      if (role !== undefined) {
        targetUser.role = role;
        const roleLabels: Record<string, string> = {
          'Admin GABAH': 'Admin GABAH (Super Admin)',
          'IT': 'Staff Divisi IT',
          'GA': 'Staff Divisi General Affairs',
          'Supply Chain': 'Staff Divisi Supply Chain',
          'PIBC': 'Staff Divisi Pasar Induk Cipinang',
          'Management': 'Direksi / Management',
          'Auditor': 'Satuan Pengawas Internal (SPI)',
          'Karyawan': 'Karyawan / Pemohon',
        };
        (targetUser as any).role_label = roleLabels[role] || role;
      }
      if (division !== undefined) targetUser.division = division;
      if (department !== undefined) targetUser.department = department.trim();
      if (is_active !== undefined) targetUser.is_active = Boolean(is_active);
      if (phone !== undefined) targetUser.phone = phone.trim();

      if (password || temp_password) {
        const plain = (password || temp_password).trim();
        if (plain) {
          const { hash, salt } = hashPassword(plain);
          targetUser.password_hash = hash;
          targetUser.password_salt = salt;
          delete targetUser.temp_password;
        }
      }

      GabahDomainService.recordAudit(
        'USER_UPDATED',
        'Users',
        `Memperbarui profil pengguna ${targetUser.name} (${targetUser.email})`,
        actor,
        targetUser.id
      );

      await persistDataStore();

      res.json({ success: true, data: sanitizeUser(targetUser) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
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

      // Auto unassign any assets assigned to this user back to available pool
      let releasedAssetsCount = 0;
      for (const a of db.assets) {
        if (a.assigned_to?.id === targetId) {
          a.status = 'available';
          a.assigned_to = null;
          releasedAssetsCount++;
        }
      }

      // Auto close/return active loans
      let closedLoansCount = 0;
      for (const l of db.loans) {
        if (l.borrower_id === targetId && ['pending_approval', 'approved', 'borrowed'].includes(l.status)) {
          l.status = 'closed';
          l.actual_returned_at = new Date().toISOString();
          l.return_condition = 'Dikembalikan otomatis karena penutupan akun pengguna';
          closedLoansCount++;
        }
      }

      // Cancel any pending reservations organized by this user
      for (const r of db.roomReservations) {
        if (r.organizer_id === targetId && ['pending_approval', 'approved', 'in_use'].includes(r.status)) {
          r.status = 'cancelled';
        }
      }

      // Invalidate all active sessions for this user
      destroyAllUserSessions(targetId);

      // Perform deletion from database
      db.users.splice(userIndex, 1);

      GabahDomainService.recordAudit(
        'USER_DELETED',
        'Users',
        `Menghapus akun pengguna: ${targetUser.name} (${targetUser.email}, ${targetUser.role}) - ${releasedAssetsCount} aset dilepaskan, ${closedLoansCount} pinjaman ditutup`,
        actor,
        targetId
      );

      await persistDataStore();

      res.json({
        success: true,
        message: `Pengguna ${targetUser.name} berhasil dihapus.${releasedAssetsCount > 0 ? ` ${releasedAssetsCount} aset berhasil dikembalikan ke status Tersedia.` : ''}`
      });
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
        if (uPrefix === inPrefix) return true;
        if ((inPrefix === 'admin' || inPrefix === 'admin.gabah' || inPrefix === 'budi.santoso') && (u.role === 'Admin GABAH' || u.id === 'USR-01')) {
          return true;
        }
        return false;
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

  app.post('/api/auth/switch-role', async (req, res) => {
    try {
      const actor = getActor(req);
      const currentSession = (req as any).session as ServerSession | undefined;

      // CRITICAL: Privilege escalation protection
      // Only Admin GABAH or an active session initiated by an Admin GABAH is allowed to switch roles
      const hasAdminPrivilege = actor.role === 'Admin GABAH' || Boolean(currentSession?.original_admin_id);
      if (!hasAdminPrivilege) {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Hanya Administrator GABAH yang berwenang melakukan alih peran atau simulasi peran.',
        });
      }

      // Preserve original admin identity across role simulation hops
      const originalAdminId = currentSession?.original_admin_id || actor.id;

      const { userId, role } = req.body;
      let targetUser = userId ? db.users.find(u => u.id === userId) : null;
      if (!targetUser && role) {
        targetUser = db.users.find(u => u.role === role);
      }

      let effectiveUser: ServerUser;
      let isSimulated = false;

      if (targetUser) {
        effectiveUser = targetUser;
      } else if (role) {
        isSimulated = true;
        // Virtual simulation persona for testing roles when only 1 admin account exists
        const roleLabels: Record<string, string> = {
          'Admin GABAH': 'Admin GABAH',
          'IT': 'IT Technical Staff',
          'GA': 'GA & Sarpras Specialist',
          'Sekretaris Direksi': 'Sekretaris Direksi & Dewan Komisaris',
          'Humas': 'Humas & Dokumentasi Protokoler',
          'Supply Chain': 'Supply Chain & Logistik',
          'PIBC': 'Petugas Pasar Induk Cipinang',
          'Karyawan': 'Pegawai Operasional (Karyawan)',
          'Auditor': 'Satuan Pengawas Internal (SPI)',
          'Management': 'Dewan Direksi & Kadiv'
        };
        const divisions: Record<string, any> = {
          'Admin GABAH': 'IT',
          'IT': 'IT',
          'GA': 'GA',
          'Sekretaris Direksi': 'GA',
          'Humas': 'GA',
          'Supply Chain': 'SC',
          'PIBC': 'PIBC',
          'Karyawan': 'SC',
          'Auditor': 'GA',
          'Management': 'IT'
        };
        effectiveUser = {
          id: `SIM-${role.replace(/\s+/g, '-').toUpperCase()}`,
          name: `Simulasi: ${actor.name || 'Pengguna'}`,
          email: `${role.toLowerCase().replace(/\s+/g, '')}@foodstation.co.id`,
          role: role as any,
          role_label: roleLabels[role] || role,
          division: divisions[role] || 'SC',
          department: `Mode Uji Coba: ${roleLabels[role] || role}`,
          avatar: actor.avatar,
          phone: actor.phone,
          is_active: true,
          password_hash: actor.password_hash,
          password_salt: actor.password_salt,
        };
      } else {
        return res.status(404).json({ success: false, message: 'User atau role target tidak ditemukan.' });
      }

      // Create legitimate session for target user (or simulated user) with preserved root admin identity
      const session = createSession(
        isSimulated ? (db.users[0]?.id || 'USR-01') : effectiveUser.id,
        req,
        isSimulated ? effectiveUser : undefined,
        originalAdminId
      );

      GabahDomainService.recordAudit(
        'AUTH_SWITCH_ROLE',
        'Auth',
        `Perpindahan role aktif ke ${effectiveUser.name} (${effectiveUser.role})`,
        actor,
        effectiveUser.id
      );

      await persistDataStore();

      res.json({
        success: true,
        data: {
          user: sanitizeUser(effectiveUser),
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
    const list = (db.categories && db.categories.length > 0) ? db.categories : CANONICAL_TAXONOMY;
    res.json({ success: true, data: list });
  });

  app.post('/api/taxonomy/categories', async (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role !== 'Admin GABAH') {
        return res.status(403).json({ 
          success: false, 
          message: 'Akses ditolak: Hanya Super Admin (Admin GABAH) yang berwenang menambahkan Master Kategori Aset.' 
        });
      }

      const { code, name, main_type, owner_division, category_type, description, is_loanable_by_default } = req.body;
      if (!code || !name || !main_type || !owner_division) {
        return res.status(400).json({ 
          success: false, 
          message: 'Kode, Nama, Jenis Utama (main_type), dan Divisi Pemilik wajib diisi.' 
        });
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!db.categories) db.categories = [...CANONICAL_TAXONOMY];

      const existing = db.categories.find(c => c.code.toUpperCase() === normalizedCode);
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: `Kategori dengan kode "${normalizedCode}" sudah terdaftar (${existing.name}).` 
        });
      }

      const newCategory = {
        code: normalizedCode,
        name: name.trim(),
        main_type,
        owner_division,
        category_type: category_type || (owner_division === 'IT' ? 'IT' : 'General'),
        description: description || `Kategori ${name.trim()} (Milik ${owner_division})`,
        is_loanable_by_default: Boolean(is_loanable_by_default),
      };

      db.categories.push(newCategory);
      GabahDomainService.recordAudit('CATEGORY_CREATED', 'MasterData', `Menambahkan master kategori ${newCategory.code} - ${newCategory.name}`, actor);
      await persistDataStore();

      res.status(201).json({ success: true, data: newCategory });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
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

  app.post('/api/assets', async (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role === 'Auditor') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      }
      if (actor.role === 'Karyawan') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Karyawan tidak memiliki wewenang mendaftarkan aset baru.' });
      }
      const newAsset = GabahDomainService.createAsset(req.body, actor);
      await persistDataStore();
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

    // Auditor is strictly read-only
    if (actor.role === 'Auditor') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
    }
    // Karyawan cannot mutate assets
    if (actor.role === 'Karyawan') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Karyawan tidak memiliki wewenang mengubah aset.' });
    }
    // Enforce Division Authority
    if (actor.role !== 'Admin GABAH') {
      if (asset.owner_division === 'IT' && actor.role !== 'IT') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset IT hanya dapat diubah oleh personel IT atau Admin GABAH.' });
      }
      if (asset.owner_division === 'GA' && actor.role !== 'GA') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset GA hanya dapat diubah oleh personel GA atau Admin GABAH.' });
      }
      if (asset.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset Supply Chain hanya dapat diubah oleh personel Supply Chain atau Admin GABAH.' });
      }
      if (asset.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset PIBC hanya dapat diubah oleh personel PIBC atau Admin GABAH.' });
      }
    }

    // Check duplicate serial number
    if (req.body.serial_number && typeof req.body.serial_number === 'string' && req.body.serial_number.trim()) {
      const sn = req.body.serial_number.trim();
      const existingSN = db.assets.find(a => a.id !== asset.id && a.serial_number && a.serial_number.trim().toLowerCase() === sn.toLowerCase());
      if (existingSN) {
        return res.status(400).json({ success: false, message: `Nomor Seri (Serial Number) "${sn}" sudah terdaftar pada aset ${existingSN.asset_number} (${existingSN.name}).` });
      }
    }

    // Check duplicate corporate asset number
    if (req.body.corporate_asset_number && typeof req.body.corporate_asset_number === 'string' && req.body.corporate_asset_number.trim()) {
      const corpNo = req.body.corporate_asset_number.trim();
      const existingCorp = db.assets.find(a => a.id !== asset.id && a.corporate_asset_number && a.corporate_asset_number.trim().toLowerCase() === corpNo.toLowerCase());
      if (existingCorp) {
        return res.status(400).json({ success: false, message: `Nomor Aset Accurate/ERP "${corpNo}" sudah terdaftar pada aset ${existingCorp.asset_number} (${existingCorp.name}).` });
      }
    }

    // Update mutable fields (not asset_number or owner_division)
    const allowed = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'status', 'corporate_asset_number'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (asset as any)[key] = req.body[key];
      }
    }
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('ASSET_UPDATED', 'Assets', `Memperbarui informasi aset ${asset.asset_number}`, actor, asset.id);
    persistDataStore().catch(() => {});

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
    if (actor.role === 'Admin GABAH' || actor.role === 'Auditor') {
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

  app.post('/api/loans', async (req, res) => {
    try {
      const actor = getActor(req);
      const { asset_ids, asset_id } = req.body;

      if (Array.isArray(asset_ids) && asset_ids.length > 0) {
        const createdLoans = [];
        for (const id of asset_ids) {
          const newLoan = GabahDomainService.requestLoan({ ...req.body, asset_id: id }, actor);
          createdLoans.push(newLoan);
        }
        await persistDataStore();
        return res.status(201).json({
          success: true,
          data: createdLoans[0],
          loans: createdLoans,
          count: createdLoans.length,
          message: `${createdLoans.length} aset pinjaman berhasil diajukan.`
        });
      }

      const newLoan = GabahDomainService.requestLoan(req.body, actor);
      await persistDataStore();
      res.status(201).json({ success: true, data: newLoan });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/approve', async (req, res) => {
    try {
      const actor = getActor(req);
      const approved = GabahDomainService.approveLoan(req.params.id, actor);
      await persistDataStore();
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/handover', async (req, res) => {
    try {
      const actor = getActor(req);
      const { handoverNotes } = req.body;
      const handedOver = GabahDomainService.handoverLoan(req.params.id, handoverNotes, actor);
      await persistDataStore();
      res.json({ success: true, data: handedOver });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/return', async (req, res) => {
    try {
      const actor = getActor(req);
      const { condition, returnNotes } = req.body;
      const returned = GabahDomainService.returnLoan(req.params.id, condition, returnNotes, actor);
      await persistDataStore();
      res.json({ success: true, data: returned });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Helpdesk Tickets
  app.get('/api/tickets', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'Admin GABAH' || actor.role === 'Auditor') {
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
    if (actor.role === 'Auditor') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
    }
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
    persistDataStore().catch(() => {});

    res.json({ success: true, data: ticket });
  });

  // Maintenance & Calibration Schedules
  app.get('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'Admin GABAH' || actor.role === 'Auditor') {
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
    if (actor.role === 'Auditor' || actor.role === 'Karyawan') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Peran Anda tidak memiliki hak membuat jadwal servis.' });
    }
    if (!req.body.asset_id) {
      return res.status(400).json({ success: false, message: 'Aset wajib dipilih untuk jadwal pemeliharaan.' });
    }
    const asset = db.assets.find(a => a.id === req.body.asset_id);
    if (!asset) {
      return res.status(400).json({ success: false, message: 'Aset yang dipilih tidak ditemukan.' });
    }

    // Enforce Division Authority
    if (actor.role !== 'Admin GABAH') {
      if (asset.owner_division === 'IT' && actor.role !== 'IT') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset IT hanya dapat dibuat oleh Divisi IT.' });
      }
      if (asset.owner_division === 'GA' && actor.role !== 'GA') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset GA hanya dapat dibuat oleh Divisi GA.' });
      }
      if (asset.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset Supply Chain hanya dapat dibuat oleh Divisi Supply Chain.' });
      }
      if (asset.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset PIBC hanya dapat dibuat oleh Divisi PIBC.' });
      }
    }

    const count = db.maintenances.length + 1;
    const scheduleCode = `MNT-2026-${String(count).padStart(3, '0')}`;
    const newSchedule = {
      id: `mnt-${Date.now()}`,
      schedule_code: scheduleCode,
      title: req.body.title || `Servis Pemeliharaan ${asset.name}`,
      asset_id: asset.id,
      asset_name: asset.name,
      asset_number: asset.asset_number,
      category_type: asset.category_type || 'General',
      owner_division: asset.owner_division,
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
    persistDataStore().catch(() => {});
    res.status(201).json({ success: true, data: newSchedule });
  });

  app.patch('/api/maintenances/:id', (req, res) => {
    const actor = getActor(req);
    if (actor.role === 'Auditor' || actor.role === 'Karyawan') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Peran Anda tidak memiliki hak memperbarui jadwal servis.' });
    }
    const schedule = db.maintenances.find(m => m.id === req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Jadwal servis tidak ditemukan' });

    if (actor.role !== 'Admin GABAH') {
      if (schedule.owner_division === 'IT' && actor.role !== 'IT') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi IT atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if (schedule.owner_division === 'GA' && actor.role !== 'GA') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi GA atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if ((schedule.owner_division === 'SC' || schedule.owner_division === 'Supply Chain') && actor.role !== 'Supply Chain') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi Supply Chain atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if (schedule.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi PIBC atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
    }

    Object.assign(schedule, req.body);
    if (req.body.status === 'completed') {
      schedule.last_completed_at = new Date().toISOString();
    }
    GabahDomainService.recordAudit('MAINTENANCE_UPDATED', 'Maintenance', `Memperbarui jadwal servis ${schedule.schedule_code} status: ${schedule.status}`, actor, schedule.id);
    persistDataStore().catch(() => {});
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
  // MEETING ROOMS & RESERVATIONS API
  // ==========================================
  app.get('/api/meeting-rooms', (req, res) => {
    res.json({ success: true, data: GabahDomainService.getMeetingRooms() });
  });

  app.patch('/api/meeting-rooms/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingRoom(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/room-reservations', (req, res) => {
    const { room_id, date, status, organizer_id } = req.query as any;
    const data = GabahDomainService.getRoomReservations({ room_id, date, status, organizer_id });
    res.json({ success: true, data });
  });

  app.post('/api/room-reservations', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.requestRoomReservation(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message,
        conflict: err.conflict || null,
        can_override: Boolean(err.can_override),
      });
    }
  });

  app.post('/api/room-reservations/:id/approve', (req, res) => {
    try {
      const actor = getActor(req);
      const approved = GabahDomainService.approveRoomReservation(req.params.id, actor);
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/reject', (req, res) => {
    try {
      const actor = getActor(req);
      const rejected = GabahDomainService.rejectRoomReservation(req.params.id, req.body.reason, actor);
      res.json({ success: true, data: rejected });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkin', (req, res) => {
    try {
      const actor = getActor(req);
      const checkedIn = GabahDomainService.checkinRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedIn });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkout', (req, res) => {
    try {
      const actor = getActor(req);
      const checkedOut = GabahDomainService.checkoutRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedOut });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/cancel', (req, res) => {
    try {
      const actor = getActor(req);
      const cancelled = GabahDomainService.cancelRoomReservation(req.params.id, actor);
      res.json({ success: true, data: cancelled });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Meeting Types CRUD API (Admin GABAH)
  app.get('/api/meeting-types', (req, res) => {
    res.json({ success: true, data: GabahDomainService.getMeetingTypes() });
  });

  app.post('/api/meeting-types', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.createMeetingType(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-types/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingType(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-types/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const result = GabahDomainService.deleteMeetingType(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Meeting Facilities CRUD API (Admin GABAH, GA, IT)
  app.get('/api/meeting-facilities', (req, res) => {
    res.json({ success: true, data: GabahDomainService.getMeetingFacilities() });
  });

  app.post('/api/meeting-facilities', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.createMeetingFacility(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-facilities/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingFacility(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-facilities/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const result = GabahDomainService.deleteMeetingFacility(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
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
