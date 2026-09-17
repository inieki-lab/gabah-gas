<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\AssetCategory;
use App\Models\AssetMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetService
{
    public function __construct(
        protected AuditLogService $auditLogService,
        protected AssetNumberingService $assetNumberingService
    ) {}

    /**
     * Mendaftarkan Aset Baru dalam Database Transaction dengan Nomor Aset Otomatis:
     * Format: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
     */
    public function createAsset(array $data, ?User $actor = null): Asset
    {
        return DB::transaction(function () use ($data, $actor) {
            $category = AssetCategory::findOrFail($data['asset_category_id']);

            // Strict Business Rule: Category-level authoritative owner division takes precedence
            $ownerDivisionId = $category->owner_division_id ? (int) $category->owner_division_id : (int) ($data['owner_division_id'] ?? 0);

            if ($ownerDivisionId <= 0) {
                throw ValidationException::withMessages([
                    'owner_division_id' => 'Divisi pemilik aset tidak valid atau belum dikonfigurasi untuk kategori ini.',
                ]);
            }

            // Generate authoritative number via pessimistic row locking
            $assetNumber = $this->assetNumberingService->generateNumber(
                $ownerDivisionId,
                $category->code
            );

            // Double check safety constraint (final safeguard)
            if (Asset::where('asset_number', $assetNumber)->exists()) {
                throw ValidationException::withMessages([
                    'asset_number' => "Nomor aset {$assetNumber} sudah terdaftar dalam sistem.",
                ]);
            }

            $asset = Asset::create([
                'asset_number' => $assetNumber,
                'corporate_asset_number' => $data['corporate_asset_number'] ?? null,
                'owner_division_id' => $ownerDivisionId,
                'asset_category_id' => $category->id,
                'name' => $data['name'],
                'brand' => $data['brand'] ?? null,
                'model' => $data['model'] ?? null,
                'serial_number' => $data['serial_number'] ?? null,
                'hostname' => $data['hostname'] ?? null,
                'ip_address' => $data['ip_address'] ?? null,
                'mac_address' => $data['mac_address'] ?? null,
                'location_id' => $data['location_id'] ?? null,
                'assigned_to_user_id' => $data['assigned_to_user_id'] ?? null,
                'pic_user_id' => $data['pic_user_id'] ?? null,
                'vendor_id' => $data['vendor_id'] ?? null,
                'status' => $data['status'] ?? AssetStatus::AVAILABLE->value,
                'condition' => $data['condition'] ?? 'good',
                'purchase_date' => $data['purchase_date'] ?? null,
                'warranty_until' => $data['warranty_until'] ?? null,
                'price' => $data['price'] ?? 0,
                'specs' => $data['specs'] ?? [],
                'is_loanable' => $data['is_loanable'] ?? false,
                'loan_blocked' => false,
                'created_by' => $actor?->id,
            ]);

            // If initial custodian is assigned, record to history
            if (! empty($data['assigned_to_user_id'])) {
                AssetAssignment::create([
                    'asset_id' => $asset->id,
                    'user_id' => $data['assigned_to_user_id'],
                    'assigned_by' => $actor?->id,
                    'assigned_at' => now(),
                    'notes' => 'Penugasan awal saat pendaftaran aset.',
                ]);
            }

            // If initial location is assigned, record to movements
            if (! empty($data['location_id'])) {
                AssetMovement::create([
                    'asset_id' => $asset->id,
                    'from_location_id' => null,
                    'to_location_id' => $data['location_id'],
                    'moved_by' => $actor?->id,
                    'moved_at' => now(),
                    'reason' => 'Penempatan fisik awal saat registrasi aset.',
                ]);
            }

            $this->auditLogService->log(
                $actor?->id,
                'ASSET_CREATE',
                Asset::class,
                $asset->id,
                null,
                $asset->toArray()
            );

            return $asset;
        });
    }

    /**
     * Memperbarui Data Aset.
     * Aturan Inti: Nomor Aset dan Divisi Pemilik bersifat IMMUTABLE.
     */
    public function updateAsset(Asset $asset, array $data, ?User $actor = null): Asset
    {
        return DB::transaction(function () use ($asset, $data, $actor) {
            $oldValues = $asset->toArray();

            // Strict immutability guards
            unset($data['asset_number']);
            unset($data['owner_division_id']);

            $asset->update($data);

            $this->auditLogService->log(
                $actor?->id,
                'ASSET_UPDATE',
                Asset::class,
                $asset->id,
                $oldValues,
                $asset->fresh()->toArray()
            );

            return $asset;
        });
    }

    /**
     * Mutasi Custodian (Serah Terima Pemegang Aset).
     */
    public function assignCustodian(Asset $asset, int $newUserId, ?string $notes = null, ?User $actor = null): AssetAssignment
    {
        return DB::transaction(function () use ($asset, $newUserId, $notes, $actor) {
            // Close previous active assignment if exists
            AssetAssignment::where('asset_id', $asset->id)
                ->whereNull('returned_at')
                ->update(['returned_at' => now()]);

            $assignment = AssetAssignment::create([
                'asset_id' => $asset->id,
                'user_id' => $newUserId,
                'assigned_by' => $actor?->id,
                'assigned_at' => now(),
                'notes' => $notes,
            ]);

            $asset->update([
                'assigned_to_user_id' => $newUserId,
                'status' => AssetStatus::IN_USE->value,
            ]);

            $this->auditLogService->log(
                $actor?->id,
                'ASSET_ASSIGN',
                Asset::class,
                $asset->id,
                ['assigned_to_user_id' => $asset->getOriginal('assigned_to_user_id')],
                ['assigned_to_user_id' => $newUserId]
            );

            return $assignment;
        });
    }

    /**
     * Mutasi Lokasi Fisik Aset.
     */
    public function moveLocation(Asset $asset, int $toLocationId, ?string $reason = null, ?User $actor = null): AssetMovement
    {
        return DB::transaction(function () use ($asset, $toLocationId, $reason, $actor) {
            $fromLocationId = $asset->location_id;

            $movement = AssetMovement::create([
                'asset_id' => $asset->id,
                'from_location_id' => $fromLocationId,
                'to_location_id' => $toLocationId,
                'moved_by' => $actor?->id,
                'moved_at' => now(),
                'reason' => $reason,
            ]);

            $asset->update([
                'location_id' => $toLocationId,
            ]);

            $this->auditLogService->log(
                $actor?->id,
                'ASSET_MOVE',
                Asset::class,
                $asset->id,
                ['location_id' => $fromLocationId],
                ['location_id' => $toLocationId]
            );

            return $movement;
        });
    }
}
