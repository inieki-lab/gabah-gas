<?php

declare(strict_types=1);

namespace App\Enums;

enum TicketStatus: string
{
    case OPEN = 'open';
    case IN_PROGRESS = 'in_progress';
    case PENDING_VENDOR = 'pending_vendor';
    case RESOLVED = 'resolved';
    case CLOSED = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::OPEN => 'Tiket Baru (Open)',
            self::IN_PROGRESS => 'Dalam Penanganan',
            self::PENDING_VENDOR => 'Menunggu Pihak Ketiga/Vendor',
            self::RESOLVED => 'Selesai Ditangani',
            self::CLOSED => 'Ditutup',
        };
    }
}
