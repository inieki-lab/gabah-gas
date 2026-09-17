<?php

declare(strict_types=1);

namespace App\Enums;

enum AssetStatus: string
{
    case ACTIVE = 'active';
    case ASSIGNED = 'assigned';
    case AVAILABLE = 'available';
    case RESERVED = 'reserved';
    case IN_REPAIR = 'in_repair';
    case DAMAGED = 'damaged';
    case CANNIBALIZED = 'cannibalized';
    case PENDING_DISPOSAL = 'pending_disposal';
    case PENDING_AUCTION = 'pending_auction';
    case AUCTIONED = 'auctioned';
    case DISPOSED = 'disposed';
    case LOST = 'lost';
    case INACTIVE = 'inactive';

    public function label(): string
    {
        return match ($this) {
            self::ACTIVE => 'Aktif',
            self::ASSIGNED => 'Ditugaskan (In Use)',
            self::AVAILABLE => 'Tersedia di Gudang / Pool',
            self::RESERVED => 'Direservasi / Dipinjam',
            self::IN_REPAIR => 'Dalam Perbaikan',
            self::DAMAGED => 'Rusak',
            self::CANNIBALIZED => 'Dikanibal (Komponen Diambil)',
            self::PENDING_DISPOSAL => 'Usulan Penghapusan (Pending Disposal)',
            self::PENDING_AUCTION => 'Usulan Lelang (Pending Auction)',
            self::AUCTIONED => 'Telah Dilelang',
            self::DISPOSED => 'Dihapuskan / Afkir',
            self::LOST => 'Hilang',
            self::INACTIVE => 'Non-Aktif',
        };
    }
}
