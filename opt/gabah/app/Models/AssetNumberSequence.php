<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetNumberSequence extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_division_id',
        'asset_code',
        'year',
        'last_number',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'last_number' => 'integer',
        ];
    }

    public function ownerDivision(): BelongsTo
    {
        return $this->belongsTo(Division::class, 'owner_division_id');
    }
}
