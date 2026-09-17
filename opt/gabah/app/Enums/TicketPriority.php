<?php

declare(strict_types=1);

namespace App\Enums;

enum TicketPriority: string
{
    case LOW = 'low';
    case MEDIUM = 'medium';
    case HIGH = 'high';
    case URGENT = 'urgent';

    public function defaultSlaHours(): int
    {
        return match ($this) {
            self::URGENT => 4,
            self::HIGH => 8,
            self::MEDIUM => 24,
            self::LOW => 48,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::LOW => 'Rendah (48 Jam)',
            self::MEDIUM => 'Sedang (24 Jam)',
            self::HIGH => 'Tinggi (8 Jam)',
            self::URGENT => 'Kritis / Urgent (4 Jam)',
        };
    }
}
