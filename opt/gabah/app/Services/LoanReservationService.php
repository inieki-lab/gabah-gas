<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\LoanStatus;
use App\Models\Asset;
use App\Models\Loan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Service Layer: Penanganan Peminjaman Barang & Anti-Bentrok Jadwal
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

            // Validasi Anti-Bentrok Jadwal
            if ($this->hasScheduleConflict($asset->id, $startDate, $endDate)) {
                throw ValidationException::withMessages([
                    'loan_date' => 'Jadwal bertabrakan dengan reservasi peminjam lain (Anti-Bentrok Aktif).',
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

            // Cek ulang anti-bentrok sebelum approval
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

    /**
     * Handover serah terima barang ke peminjam (Active)
     */
    public function handoverAsset(Loan $loan, User $staff): Loan
    {
        return DB::transaction(function () use ($loan, $staff) {
            $lockedLoan = Loan::where('id', $loan->id)->lockForUpdate()->firstOrFail();
            $asset = Asset::where('id', $lockedLoan->asset_id)->lockForUpdate()->firstOrFail();

            $oldValues = $lockedLoan->toArray();

            $lockedLoan->update([
                'status' => LoanStatus::ACTIVE->value,
                'received_by' => $staff->id,
            ]);

            $asset->update([
                'status' => 'loaned',
            ]);

            $this->auditLogService->log(
                $staff->id,
                'LOAN_HANDOVER',
                Loan::class,
                $lockedLoan->id,
                $oldValues,
                $lockedLoan->fresh()->toArray()
            );

            return $lockedLoan;
        });
    }

    /**
     * Pengembalian barang (Return)
     */
    public function returnAsset(Loan $loan, User $staff, array $returnData): Loan
    {
        return DB::transaction(function () use ($loan, $staff, $returnData) {
            $lockedLoan = Loan::where('id', $loan->id)->lockForUpdate()->firstOrFail();
            $asset = Asset::where('id', $lockedLoan->asset_id)->lockForUpdate()->firstOrFail();

            $oldValues = $lockedLoan->toArray();

            $lockedLoan->update([
                'status' => LoanStatus::RETURNED->value,
                'returned_at' => now(),
                'notes' => trim(($lockedLoan->notes ?? '') . "\n[Return Notes]: " . ($returnData['notes'] ?? 'Kondisi baik')),
            ]);

            $asset->update([
                'status' => 'available',
            ]);

            $this->auditLogService->log(
                $staff->id,
                'LOAN_RETURN',
                Loan::class,
                $lockedLoan->id,
                $oldValues,
                $lockedLoan->fresh()->toArray()
            );

            return $lockedLoan;
        });
    }
}
