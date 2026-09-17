<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AssetStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Asset extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'asset_number',
        'corporate_asset_number',
        'owner_division_id',
        'asset_category_id',
        'location_id',
        'assigned_to_user_id',
        'pic_user_id',
        'vendor_id',
        'name',
        'brand',
        'model',
        'serial_number',
        'hostname',
        'ip_address',
        'mac_address',
        'status',
        'condition',
        'price',
        'purchase_date',
        'warranty_until',
        'specs',
        'is_loanable',
        'loan_blocked',
        'loan_blocked_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AssetStatus::class,
            'purchase_date' => 'date',
            'warranty_until' => 'date',
            'price' => 'decimal:2',
            'specs' => 'array',
            'is_loanable' => 'boolean',
            'loan_blocked' => 'boolean',
        ];
    }

    public function ownerDivision(): BelongsTo
    {
        return $this->belongsTo(Division::class, 'owner_division_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'location_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function pic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pic_user_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'vendor_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class, 'asset_id')->latest('assigned_at');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(AssetMovement::class, 'asset_id')->latest('moved_at');
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'asset_id');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'asset_id');
    }
}
