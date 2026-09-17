<?php

declare(strict_types=1);

namespace App\Enums;

enum CategoryType: string
{
    case IT = 'IT';
    case GENERAL = 'General';
    case LICENSE = 'License';

    public function label(): string
    {
        return match ($this) {
            self::IT => 'Aset Teknologi Informasi',
            self::GENERAL => 'Aset Umum / Fasilitas',
            self::LICENSE => 'Lisensi & Kontrak Software',
        };
    }
}
