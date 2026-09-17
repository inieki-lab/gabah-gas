<?php

declare(strict_types=1);

namespace App\Enums;

enum AssetCondition: string
{
    case NEW = 'new';
    case GOOD = 'good';
    case FAIR = 'fair';
    case POOR = 'poor';
    case BROKEN = 'broken';

    public function label(): string
    {
        return match ($this) {
            self::NEW => 'Baru (New)',
            self::GOOD => 'Baik (Good)',
            self::FAIR => 'Cukup / Wajar (Fair)',
            self::POOR => 'Kurang / Butuh Perbaikan (Poor)',
            self::BROKEN => 'Rusak Total (Broken)',
        };
    }
}
