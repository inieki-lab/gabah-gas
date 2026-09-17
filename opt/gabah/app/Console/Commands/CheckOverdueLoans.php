<?php

namespace App\Console\Commands;

use App\Models\Loan;
use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CheckOverdueLoans extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'loans:check-overdue {--dry-run : Run without updating records}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Periksa pinjaman aset yang melewati batas waktu pengembalian (Overdue) dan catat audit log pelanggaran';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Memulai inspeksi pinjaman aset yang jatuh tempo (Overdue)...');

        $now = now();
        $isDryRun = $this->option('dry-run');

        // Check active / loaned records where due_date has passed
        $overdueLoans = Loan::whereIn('status', ['active', 'loaned', 'approved'])
            ->where('due_date', '<', $now)
            ->with(['asset', 'borrower'])
            ->get();

        if ($overdueLoans->isEmpty()) {
            $this->info('Tidak ditemukan pinjaman yang melewati batas jatuh tempo.');
            return Command::SUCCESS;
        }

        $this->warn("Ditemukan {$overdueLoans->count()} pinjaman overdue. Memproses...");

        foreach ($overdueLoans as $loan) {
            $daysOverdue = (int) $now->diffInDays($loan->due_date);
            $assetNumber = $loan->asset?->asset_number ?? 'Unknown';
            $borrowerName = $loan->borrower?->name ?? 'Unknown';

            $this->line("- [OVERDUE] Loan: {$loan->loan_number} | Aset: {$assetNumber} | Peminjam: {$borrowerName} ({$daysOverdue} hari terlambat)");

            if (! $isDryRun) {
                DB::transaction(function () use ($loan, $daysOverdue, $now) {
                    $oldStatus = $loan->status;
                    $loan->update([
                        'status' => 'overdue',
                    ]);

                    AuditLog::create([
                        'user_id' => null, // Automated System Action
                        'action' => 'LOAN_OVERDUE_FLAGGED',
                        'auditable_type' => Loan::class,
                        'auditable_id' => $loan->id,
                        'old_values' => ['status' => $oldStatus],
                        'new_values' => [
                            'status' => 'overdue',
                            'days_overdue' => $daysOverdue,
                            'flagged_at' => $now->toIso8601String(),
                        ],
                        'ip_address' => '127.0.0.1',
                        'user_agent' => 'GABAH_CRON_SCHEDULER',
                        'created_at' => $now,
                    ]);
                });
            }
        }

        $this->info('Pemeriksaan status pinjaman overdue selesai.');
        return Command::SUCCESS;
    }
}
