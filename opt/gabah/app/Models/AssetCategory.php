<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\CategoryType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_division_id',
        'code',
        'name',
        'description',
        'category_type',
        'is_active',
    ];

    protected $casts = [
        'owner_division_id' => 'integer',
        'category_type' => CategoryType::class,
        'is_active' => 'boolean',
    ];

    public function ownerDivision(): BelongsTo
    {
        return $this->belongsTo(Division::class, 'owner_division_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }
}
