<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Asset;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface AssetRepositoryInterface
{
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator;

    public function findById(int $id): ?Asset;

    public function findByAssetNumber(string $assetNumber): ?Asset;

    public function store(array $data): Asset;

    public function update(Asset $asset, array $data): bool;

    public function delete(Asset $asset): bool;
}
