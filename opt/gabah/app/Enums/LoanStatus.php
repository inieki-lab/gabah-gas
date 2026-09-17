<?php

declare(strict_types=1);

namespace App\Enums;

enum LoanStatus: string
{
    case PENDING = 'pending';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';
    case ACTIVE = 'active';
    case RETURNED = 'returned';
    case OVERDUE = 'overdue';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'Menunggu Persetujuan',
            self::APPROVED => 'Disetujui (Siap Ambil)',
            self::REJECTED => 'Ditolak',
            self::ACTIVE => 'Sedang Dipinjam',
            self::RETURNED => 'Telah Dikembalikan',
            self::OVERDUE => 'Terlambat Kembali',
        };
    }
}
