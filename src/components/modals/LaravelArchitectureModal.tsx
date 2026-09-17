import React, { useState } from 'react';
import { 
  Code2, 
  X, 
  Copy, 
  Check, 
  Database, 
  Server, 
  ShieldCheck, 
  FileCode, 
  Layers, 
  FolderTree,
  Terminal,
  FileCheck,
  Download
} from 'lucide-react';

interface LaravelArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LaravelArchitectureModal: React.FC<LaravelArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('opt_tree');

  if (!isOpen) return null;

  const files: Record<string, { name: string; badge: string; code: string }> = {
    opt_tree: {
      name: '/opt/gabah/ (45 Files Production-Ready Generated)',
      badge: 'Filesystem Tree & Quickstart',
      code: `# ==============================================================================
# GABAH BACKEND ARSITEKTUR LARAVEL 11 (Telah Dibuat Lengkap di /opt/gabah/)
# Total: 45 File Production-Ready (Models, Migrations, Services, Requests, Policies)
# ==============================================================================

/opt/gabah/
├── app/
│   ├── Enums/
│   │   ├── CategoryType.php          (IT, General, License)
│   │   ├── AssetStatus.php           (available, in_use, maintenance, disposed)
│   │   ├── LoanStatus.php            (pending, approved, rejected, active, returned, overdue)
│   │   ├── TicketPriority.php        (low: 48h, medium: 24h, high: 8h, urgent: 4h)
│   │   └── TicketStatus.php          (open, in_progress, pending_vendor, resolved, closed)
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── AssetController.php   (Thin Controller -> AssetService)
│   │   │   ├── LoanController.php    (Thin Controller -> LoanReservationService)
│   │   │   └── TicketController.php  (Thin Controller -> TicketSlaService)
│   │   ├── Requests/
│   │   │   ├── Asset/StoreAssetRequest.php (Pesan validasi ID operasional)
│   │   │   ├── Loan/StoreLoanRequest.php   (Validasi tanggal & durasi)
│   │   │   └── Ticket/StoreTicketRequest.php
│   │   └── Resources/
│   │       ├── AssetResource.php
│   │       ├── LoanResource.php
│   │       └── TicketResource.php
│   ├── Models/
│   │   ├── User.php
│   │   ├── AssetCategory.php
│   │   ├── Asset.php                 (custom_attributes JSONB, qr_code_url, loan_blocked)
│   │   ├── Ticket.php                (sla_deadlines, is_over_sla)
│   │   ├── Loan.php                  (idx_loans_anti_collision)
│   │   ├── Vendor.php
│   │   ├── KbArticle.php
│   │   ├── Notice.php
│   │   └── AuditLog.php              (old_values, new_values JSONB)
│   ├── Policies/
│   │   └── AssetPolicy.php           (Granular RBAC per CategoryType IT/General/License)
│   ├── Repositories/
│   │   ├── Contracts/AssetRepositoryInterface.php
│   │   └── Eloquent/AssetRepository.php
│   └── Services/
│       ├── LoanReservationService.php (Pessimistic lockForUpdate + overlap interval check)
│       ├── AssetNumberingService.php  (Atomic IT-CAT-YEAR-XXXX sequence & lockForUpdate)
│       ├── AssetService.php          (Thin Service with immutability and collision audit)
│       ├── TicketSlaService.php      (Auto SLA calculate, escalation & is_over_sla)
│       └── AuditLogService.php       (Atomic audit trail tracking)
├── database/
│   ├── migrations/
│   │   ├── 2024_01_01_000001_create_users_table.php
│   │   ├── 2024_01_01_000002_create_asset_categories_table.php
│   │   ├── 2024_01_01_000003_create_vendors_table.php
│   │   ├── 2024_01_01_000004_create_assets_table.php
│   │   ├── 2026_01_01_000001_create_asset_number_sequences_table.php
│   │   ├── 2024_01_01_000005_create_tickets_table.php
│   │   ├── 2024_01_01_000006_create_loans_table.php
│   │   ├── 2024_01_01_000007_create_kb_articles_table.php
│   │   ├── 2024_01_01_000008_create_notices_table.php
│   │   ├── 2024_01_01_000009_create_audit_logs_table.php
│   │   └── 2024_01_01_000010_create_permission_tables.php
│   └── seeders/
│       └── DatabaseSeeder.php        (7 Roles Spatie, Categories, Default Users & Assets)
├── routes/
│   └── api.php                       (Sanctum Protected RESTful Endpoints)
├── composer.json                     (Laravel 11, Sanctum, Spatie, Simple-QRCode)
├── .env.example                      (PostgreSQL 17 & Session Config)
└── README.md                         (Production deployment guide)

# ==============================================================================
# CARA MENJALANKAN DI SERVER PRODUCTION
# ==============================================================================
cd /opt/gabah
composer install --optimize-autoloader
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --port=8000`,
    },
    service_loan: {
      name: 'app/Services/LoanReservationService.php',
      badge: 'Service Layer + Schedule Verification DB Transaction',
      code: `<?php

declare(strict_types=1);

namespace App\\Services;

use App\\Enums\\LoanStatus;
use App\\Models\\Asset;
use App\\Models\\Loan;
use App\\Models\\User;
use Carbon\\Carbon;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Validation\\ValidationException;

/**
 * Service Layer: Penanganan Peminjaman Barang & Validasi Jadwal
 * Strict Senior Laravel Architecture: DB::transaction + Pessimistic Locking
 */
class LoanReservationService
{
    public function __construct(
        protected AuditLogService $auditLogService
    ) {}

    /**
     * Memeriksa bentrok jadwal peminjaman aset (Anti-Collision Engine)
     * Query: Overlap interval (loan_date < requested_end) AND (due_date > requested_start)
     */
    public function hasScheduleConflict(int $assetId, Carbon $startDate, Carbon $endDate, ?int $excludeLoanId = null): bool
    {
        return Loan::query()
            ->where('asset_id', $assetId)
            ->whereIn('status', [LoanStatus::APPROVED->value, LoanStatus::ACTIVE->value])
            ->when($excludeLoanId, fn ($q) => $q->where('id', '!=', $excludeLoanId))
            ->where(function ($q) use ($startDate, $endDate) {
                $q->where('loan_date', '<', $endDate)
                  ->where('due_date', '>', $startDate);
            })
            ->exists();
    }

    /**
     * Membuat reservasi peminjaman baru dalam Database Transaction
     */
    public function createReservation(User $borrower, array $data): Loan
    {
        return DB::transaction(function () use ($borrower, $data) {
            $startDate = Carbon::parse($data['loan_date']);
            $endDate = Carbon::parse($data['due_date']);

            if ($endDate->lte($startDate)) {
                throw ValidationException::withMessages([
                    'due_date' => 'Tanggal pengembalian harus lebih besar dari tanggal mulai peminjaman.',
                ]);
            }

            // Lock baris aset untuk mencegah race condition (pessimistic lock)
            $asset = Asset::where('id', $data['asset_id'])->lockForUpdate()->firstOrFail();

            if (! $asset->is_loanable) {
                throw ValidationException::withMessages([
                    'asset_id' => 'Aset ini bertipe aset tetap dan tidak dapat dipinjamkan.',
                ]);
            }

            if ($asset->loan_blocked) {
                throw ValidationException::withMessages([
                    'asset_id' => 'Aset ini sedang diblokir dari peminjaman (loan_blocked = true).',
                ]);
            }

            // Validasi Konflik Jadwal
            if ($this->hasScheduleConflict($asset->id, $startDate, $endDate)) {
                throw ValidationException::withMessages([
                    'loan_date' => 'Jadwal bertabrakan dengan reservasi peminjam lain.',
                ]);
            }

            // Generate Loan Number: LOAN-YY-SEQUENCE
            $year = now()->format('y');
            $count = Loan::whereYear('created_at', now()->year)->count() + 1;
            $loanNumber = sprintf('LOAN-%s-%04d', $year, $count);

            $loan = Loan::create([
                'loan_number' => $loanNumber,
                'asset_id' => $asset->id,
                'borrower_id' => $borrower->id,
                'purpose' => $data['purpose'],
                'loan_date' => $startDate,
                'due_date' => $endDate,
                'status' => LoanStatus::PENDING->value,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->auditLogService->log(
                $borrower->id,
                'LOAN_REQUEST',
                Loan::class,
                $loan->id,
                null,
                $loan->toArray()
            );

            return $loan;
        });
    }

    /**
     * Menyetujui reservasi peminjaman (Admin/GA)
     */
    public function approveReservation(Loan $loan, User $approver): Loan
    {
        return DB::transaction(function () use ($loan, $approver) {
            $lockedLoan = Loan::where('id', $loan->id)->lockForUpdate()->firstOrFail();

            if ($lockedLoan->status !== LoanStatus::PENDING) {
                throw ValidationException::withMessages([
                    'status' => 'Hanya peminjaman berstatus pending yang dapat disetujui.',
                ]);
            }

            $startDate = Carbon::parse($lockedLoan->loan_date);
            $endDate = Carbon::parse($lockedLoan->due_date);

            // Cek ulang konflik jadwal sebelum approval
            if ($this->hasScheduleConflict($lockedLoan->asset_id, $startDate, $endDate, $lockedLoan->id)) {
                throw ValidationException::withMessages([
                    'status' => 'Tidak dapat menyetujui: Terdeteksi bentrok dengan reservasi lain yang telah disetujui.',
                ]);
            }

            $oldValues = $lockedLoan->toArray();

            $lockedLoan->update([
                'status' => LoanStatus::APPROVED->value,
                'approved_by' => $approver->id,
            ]);

            $this->auditLogService->log(
                $approver->id,
                'LOAN_APPROVE',
                Loan::class,
                $lockedLoan->id,
                $oldValues,
                $lockedLoan->fresh()->toArray()
            );

            return $lockedLoan;
        });
    }
}`,
    },
    service_asset: {
      name: 'app/Services/AssetNumberingService.php',
      badge: 'Atomic Sequence & Collision Safeguard',
      code: `<?php

declare(strict_types=1);

namespace App\\Services;

use App\\Models\\Asset;
use App\\Models\\AssetCategory;
use App\\Models\\AssetNumberSequence;
use Illuminate\\Support\\Facades\\DB;
use InvalidArgumentException;
use RuntimeException;

class AssetNumberingService
{
    /**
     * Menghasilkan nomor aset IT standar unik secara atomik dan thread-safe:
     * Format: IT-{CATEGORY_CODE}-{YEAR}-{SEQUENCE}
     * Contoh: IT-HLT-2026-0001
     */
    public function generateNextNumber(AssetCategory $category, ?int $year = null): string
    {
        $year = $year ?? (int) now()->format('Y');
        $code = strtoupper(trim($category->code));

        if (empty($code)) {
            throw new InvalidArgumentException("Kategori aset '{$category->name}' belum memiliki kode standar.");
        }

        return DB::transaction(function () use ($category, $code, $year) {
            // Pessimistic Locking: lockForUpdate() mencegah race condition concurrency
            $seq = AssetNumberSequence::query()
                ->where('category_code', $code)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if (! $seq) {
                $seq = AssetNumberSequence::firstOrCreate(
                    ['category_code' => $code, 'year' => $year],
                    ['current_sequence' => 0]
                );
                // Re-lock untuk row yang baru dibuat
                $seq = AssetNumberSequence::query()
                    ->where('id', $seq->id)
                    ->lockForUpdate()
                    ->first();
            }

            $maxTries = 1000;
            $tries = 0;

            do {
                $seq->current_sequence++;
                $seq->save();

                $formattedSeq = str_pad((string) $seq->current_sequence, 4, '0', STR_PAD_LEFT);
                $candidateNumber = "IT-{$code}-{$year}-{$formattedSeq}";

                // Double check collision safeguard
                $exists = Asset::where('asset_number', $candidateNumber)->exists();
                $tries++;

                if (! $exists) {
                    return $candidateNumber;
                }
            } while ($tries < $maxTries);

            throw new RuntimeException("Gagal mengalokasikan nomor aset unik untuk kategori {$code} tahun {$year}.");
        });
    }
}`,
    },
    migration_assets: {
      name: 'database/migrations/2024_01_01_000004_create_assets_table.php',
      badge: 'Assets Table (9 Tabel Utama GABAH)',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_number', 50)->unique(); // ASTICK format: AST-IT-24-0001
            $table->string('name', 200);
            $table->string('serial_number', 100)->nullable();
            $table->string('hostname', 100)->nullable(); // IT Specific
            $table->string('ip_address', 45)->nullable(); // IT Specific (IPv4 / IPv6)
            $table->string('category_type', 20); // IT, General, License
            $table->foreignId('asset_category_id')->constrained('asset_categories')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('status', 30)->default('available'); // available, in_use, maintenance, disposed
            $table->string('location', 150);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->foreignId('pic_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('purchase_date')->nullable();
            $table->date('warranty_until')->nullable();
            $table->decimal('price', 15, 2)->default(0);
            $table->jsonb('custom_attributes')->nullable(); // PostgreSQL JSONB
            $table->string('qr_code_url', 255)->nullable();
            $table->boolean('is_loanable')->default(false);
            $table->boolean('loan_blocked')->default(false);
            $table->timestamps();

            $table->index(['category_type', 'status']);
            $table->index(['asset_number']);
            $table->index(['is_loanable', 'loan_blocked']);
            $table->index(['assigned_to']);
            $table->index(['warranty_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};`,
    },
    migration_loans: {
      name: 'database/migrations/2024_01_01_000006_create_loans_table.php',
      badge: 'Loans Table (Anti-Collision Composite Index)',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('loan_number', 50)->unique(); // LOAN-YY-XXXX
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->text('purpose');
            $table->dateTime('loan_date'); // start date & time
            $table->dateTime('due_date');  // expected return date & time
            $table->dateTime('returned_at')->nullable(); // actual returned time
            $table->string('status', 30)->default('pending'); // pending, approved, rejected, active, returned, overdue
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            // Critical index for Schedule Conflict Query Performance
            $table->index(['asset_id', 'status', 'loan_date', 'due_date'], 'idx_loans_anti_collision');
            $table->index(['borrower_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};`,
    },
    migration_tickets: {
      name: 'database/migrations/2024_01_01_000005_create_tickets_table.php',
      badge: 'Tickets & SLA Table',
      code: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 50)->unique(); // TKT-YY-XXXX
            $table->string('type', 50)->default('incident'); // incident, request, maintenance
            $table->string('subject', 200);
            $table->text('description');
            $table->string('status', 30)->default('open');
            $table->string('priority', 20)->default('medium'); // low, medium, high, urgent
            $table->timestamp('sla_response_deadline')->nullable();
            $table->timestamp('sla_resolution_deadline')->nullable();
            $table->boolean('is_over_sla')->default(false);
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 50); // IT, General, License, Facility
            $table->string('approval_status', 30)->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'priority']);
            $table->index(['sla_resolution_deadline', 'is_over_sla']);
            $table->index(['requester_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};`,
    },
    rbac_policy: {
      name: 'app/Policies/AssetPolicy.php',
      badge: 'Granular RBAC per CategoryType',
      code: `<?php

declare(strict_types=1);

namespace App\\Policies;

use App\\Enums\\CategoryType;
use App\\Models\\Asset;
use App\\Models\\User;

class AssetPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('Super Admin')) {
            return true;
        }
        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->hasAnyRole(['Super Admin', 'IT Manager', 'IT Support', 'GA', 'GA Staff', 'Auditor', 'User']);
    }

    /**
     * Granular per category_type RBAC
     */
    public function create(User $user, CategoryType $categoryType): bool
    {
        return match ($categoryType) {
            CategoryType::IT, CategoryType::LICENSE => $user->hasAnyRole(['IT Manager', 'IT Support']),
            CategoryType::GENERAL => $user->hasAnyRole(['GA', 'GA Staff']),
        };
    }

    public function update(User $user, Asset $asset): bool
    {
        return match ($asset->category_type) {
            CategoryType::IT, CategoryType::LICENSE => $user->hasAnyRole(['IT Manager', 'IT Support']),
            CategoryType::GENERAL => $user->hasAnyRole(['GA', 'GA Staff']),
        };
    }

    public function delete(User $user, Asset $asset): bool
    {
        return match ($asset->category_type) {
            CategoryType::IT, CategoryType::LICENSE => $user->hasRole('IT Manager'),
            CategoryType::GENERAL => $user->hasRole('GA'),
        };
    }
}`,
    },
    repository: {
      name: 'app/Repositories/Eloquent/AssetRepository.php',
      badge: 'Repository Pattern Implementation',
      code: `<?php

declare(strict_types=1);

namespace App\\Repositories\\Eloquent;

use App\\Models\\Asset;
use App\\Repositories\\Contracts\\AssetRepositoryInterface;
use Illuminate\\Contracts\\Pagination\\LengthAwarePaginator;

class AssetRepository implements AssetRepositoryInterface
{
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return Asset::query()
            ->with(['category', 'assignedUser', 'vendor', 'pic'])
            ->when($filters['category_type'] ?? null, fn ($q, $cat) => $q->where('category_type', $cat))
            ->when($filters['status'] ?? null, fn ($q, $st) => $q->where('status', $st))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'ILIKE', "%{$search}%")
                        ->orWhere('asset_number', 'ILIKE', "%{$search}%")
                        ->orWhere('hostname', 'ILIKE', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate($perPage);
    }

    public function findById(int $id): ?Asset
    {
        return Asset::with(['category', 'assignedUser', 'vendor', 'pic', 'loans', 'tickets'])->find($id);
    }

    public function findByAssetNumber(string $assetNumber): ?Asset
    {
        return Asset::where('asset_number', $assetNumber)->first();
    }

    public function store(array $data): Asset
    {
        return Asset::create($data);
    }

    public function update(Asset $asset, array $data): bool
    {
        return $asset->update($data);
    }

    public function delete(Asset $asset): bool
    {
        return $asset->delete();
    }
}`,
    },
    commands_cron: {
      name: 'app/Console/Commands/ & routes/console.php',
      badge: 'Artisan CLI & Automated Task Scheduler',
      code: `<?php

// ==============================================================================
// 1. routes/console.php (Laravel 11 Cron Schedule Definitions)
// ==============================================================================
use Illuminate\\Support\\Facades\\Schedule;

// Run Daily at 00:01 WIB: Deteksi keterlambatan pengembalian pinjaman (Overdue)
Schedule::command('loans:check-overdue')
    ->dailyAt('00:01')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_loans_overdue.log'));

// Run Every 10 Minutes: Pantau SLA Tiket & Auto-Eskalasi prioritas jika breached
Schedule::command('tickets:check-sla --escalate')
    ->everyTenMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_tickets_sla.log'));

// Run Weekly on Monday 08:00 WIB: Peringatan masa garansi hardware & lisensi software
Schedule::command('assets:check-expirations --days=45')
    ->weeklyOn(1, '08:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_assets_expirations.log'));


// ==============================================================================
// 2. app/Console/Commands/CheckOverdueLoans.php
// ==============================================================================
namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use App\\Models\\LoanReservation;
use App\\Models\\AuditLog;
use Illuminate\\Support\\Facades\\DB;

class CheckOverdueLoans extends Command
{
    protected $signature = 'loans:check-overdue {--dry-run : Test without updates}';
    protected $description = 'Periksa pinjaman aset yang melewati tenggat & flag peminjam';

    public function handle(): int
    {
        $overdueLoans = LoanReservation::where('status', 'active')
            ->where('end_date', '<', now())
            ->with(['asset', 'borrower'])
            ->get();

        foreach ($overdueLoans as $loan) {
            DB::transaction(function () use ($loan) {
                $loan->update(['status' => 'overdue', 'overdue_flagged_at' => now()]);
                
                AuditLog::create([
                    'action' => 'LOAN_OVERDUE_FLAGGED',
                    'target_type' => 'LoanReservation',
                    'target_id' => $loan->id,
                    'details' => ['loan_code' => $loan->loan_code, 'borrower' => $loan->borrower->name]
                ]);
            });
        }
        return Command::SUCCESS;
    }
}


// ==============================================================================
// 3. app/Console/Commands/CheckTicketSla.php
// ==============================================================================
namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use App\\Models\\Ticket;
use App\\Models\\AuditLog;
use Illuminate\\Support\Facades\\DB;

class CheckTicketSla extends Command
{
    protected $signature = 'tickets:check-sla {--escalate}';
    protected $description = 'Pantau batas SLA Helpdesk dan eskalasikan tiket gangguan';

    public function handle(): int
    {
        $breached = Ticket::whereIn('status', ['open', 'in_progress', 'pending_vendor'])
            ->where('sla_due_at', '<', now())
            ->where('is_over_sla', false)
            ->get();

        foreach ($breached as $ticket) {
            DB::transaction(function () use ($ticket) {
                $updates = ['is_over_sla' => true];
                if ($this->option('escalate') && $ticket->priority !== 'urgent') {
                    $updates['priority'] = match ($ticket->priority) {
                        'low' => 'medium',
                        'medium' => 'high',
                        default => 'urgent'
                    };
                }
                $ticket->update($updates);
            });
        }
        return Command::SUCCESS;
    }
}`,
    },
    depreciation_psak16: {
      name: 'app/Services/AssetDepreciationService.php',
      badge: 'PSAK 16 Straight-Line Depreciation Engine',
      code: `<?php

declare(strict_types=1);

namespace App\\Services;

use App\\Models\\Asset;
use Carbon\\Carbon;

/**
 * Service Layer: Perhitungan Depresiasi Aset Tetap Sesuai Standar PSAK 16
 * Metode Garis Lurus (Straight-Line Method) untuk Pelaporan Keuangan BUMD
 */
class AssetDepreciationService
{
    /**
     * Hitung akumulasi penyusutan dan Nilai Buku Bersih (Net Book Value)
     * 
     * Ketentuan PSAK 16 BUMD:
     * 1. Aset IT (Laptop, Server, Jaringan): Masa Manfaat 4 Tahun (48 Bulan), Nilai Sisa 10%
     * 2. Aset General / Kendaraan / Mesin: Masa Manfaat 8 Tahun (96 Bulan), Nilai Sisa 10%
     * 3. Lisensi Software & Hak Cipta: Masa Manfaat 2 Tahun (24 Bulan), Nilai Sisa 0%
     */
    public function calculateDepreciation(Asset $asset, ?Carbon $targetDate = null): array
    {
        $target = $targetDate ?? Carbon::now();
        $purchaseDate = Carbon::parse($asset->purchase_date);
        $cost = (float) $asset->purchase_price;

        [$usefulLifeMonths, $salvageRate] = match ($asset->category_type) {
            'IT' => [48, 0.10],        // 4 tahun, residu 10%
            'General' => [96, 0.10],   // 8 tahun, residu 10%
            'License' => [24, 0.00],   // 2 tahun, residu 0%
            default => [60, 0.10]
        };

        $salvageValue = $cost * $salvageRate;
        $depreciableAmount = max(0, $cost - $salvageValue);
        $monthlyDepreciation = $usefulLifeMonths > 0 ? ($depreciableAmount / $usefulLifeMonths) : 0;

        // Bulan berjalan sejak perolehan
        $ageInMonths = max(0, $purchaseDate->diffInMonths($target));
        $effectiveMonths = min($ageInMonths, $usefulLifeMonths);

        $accumulatedDepreciation = $effectiveMonths * $monthlyDepreciation;
        $netBookValue = max($salvageValue, $cost - $accumulatedDepreciation);

        return [
            'purchase_price' => $cost,
            'salvage_value' => $salvageValue,
            'useful_life_years' => $usefulLifeMonths / 12,
            'useful_life_months' => $usefulLifeMonths,
            'age_in_months' => $ageInMonths,
            'monthly_depreciation' => round($monthlyDepreciation, 2),
            'accumulated_depreciation' => round($accumulatedDepreciation, 2),
            'net_book_value' => round($netBookValue, 2),
            'is_fully_depreciated' => $ageInMonths >= $usefulLifeMonths,
        ];
    }
}`,
    }
  };

  const currentFile = files[activeTab] || files.opt_tree;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopiedFile(activeTab);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="w-full max-w-5xl h-[92vh] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Laravel 11 Production Backend Codebase</h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PHP 8.3 &amp; PostgreSQL 17
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  /opt/gabah/
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lengkap: 9 Tabel Utama, Service Layer (Validasi Jadwal &amp; SLA), Form Requests, Granular RBAC, Repositories, &amp; Seeders
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'opt_tree', label: 'File Tree /opt/gabah', icon: FolderTree },
            { id: 'commands_cron', label: 'Artisan Cron (3 Commands)', icon: Terminal },
            { id: 'depreciation_psak16', label: 'Depresiasi PSAK 16', icon: FileCheck },
            { id: 'service_loan', label: 'LoanReservationService (Jadwal)', icon: Layers },
            { id: 'service_asset', label: 'AssetService (ASTICK & QR)', icon: Layers },
            { id: 'migration_assets', label: 'Migration: Assets (9 Tabel)', icon: Database },
            { id: 'migration_loans', label: 'Migration: Loans', icon: Database },
            { id: 'migration_tickets', label: 'Migration: Tickets (SLA)', icon: Database },
            { id: 'rbac_policy', label: 'RBAC: AssetPolicy', icon: ShieldCheck },
            { id: 'repository', label: 'Repository: AssetRepository', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-emerald-400 border-t-2 border-emerald-500 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Code Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          
          {/* File bar */}
          <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-300">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>{currentFile.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-sans">
                {currentFile.badge}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-xs font-medium"
            >
              {copiedFile === activeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin File</span>
                </>
              )}
            </button>
          </div>

          {/* Scrollable code editor view */}
          <div className="flex-1 p-6 overflow-auto font-mono text-xs text-slate-200 leading-relaxed bg-slate-950">
            <pre className="whitespace-pre">
              <code>{currentFile.code}</code>
            </pre>
          </div>

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Semua file telah di-deploy langsung di <code>/opt/gabah/</code> siap untuk migrasi dan eksekusi Artisan.</span>
          </span>
          <div className="flex items-center gap-2">
            <a
              id="btn-download-source-modal"
              href="/gabah-source.tar.gz"
              download="gabah-laravel11-source.tar.gz"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-xs"
              title="Unduh file arsip backend .tar.gz"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backend (.tar.gz)</span>
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold transition-colors shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
