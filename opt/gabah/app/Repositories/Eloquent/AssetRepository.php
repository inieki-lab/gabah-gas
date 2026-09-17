<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Asset;
use App\Repositories\Contracts\AssetRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class AssetRepository implements AssetRepositoryInterface
{
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return Asset::query()
            ->with(['category', 'assignedUser', 'vendor', 'pic'])
            ->when($filters['category_type'] ?? null, fn ($q, $cat) => $q->where('category_type', $cat))
            ->when($filters['status'] ?? null, fn ($q, $st) => $q->where('status', $st))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'ILIKE', "%{$search}%")
                        ->orWhere('asset_number', 'ILIKE', "%{$search}%")
                        ->orWhere('hostname', 'ILIKE', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate($perPage);
    }

    public function findById(int $id): ?Asset
    {
        return Asset::with(['category', 'assignedUser', 'vendor', 'pic', 'loans', 'tickets'])->find($id);
    }

    public function findByAssetNumber(string $assetNumber): ?Asset
    {
        return Asset::where('asset_number', $assetNumber)->first();
    }

    public function store(array $data): Asset
    {
        return Asset::create($data);
    }

    public function update(Asset $asset, array $data): bool
    {
        return $asset->update($data);
    }

    public function delete(Asset $asset): bool
    {
        return $asset->delete();
    }
}
