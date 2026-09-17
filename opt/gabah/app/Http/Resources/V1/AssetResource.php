<?php

declare(strict_types=1);

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetResource extends JsonResource
{
    /**
     * Transform the resource into an array conforming to GABAH Phase 1 standards.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_number' => $this->asset_number,
            'corporate_asset_number' => $this->corporate_asset_number,
            'name' => $this->name,
            'brand' => $this->brand,
            'model' => $this->model,
            'serial_number' => $this->serial_number,
            'hostname' => $this->hostname,
            'ip_address' => $this->ip_address,
            'mac_address' => $this->mac_address,
            'status' => $this->status?->value ?? $this->status,
            'condition' => $this->condition,
            'price' => (float) $this->price,
            'purchase_date' => $this->purchase_date?->format('Y-m-d'),
            'warranty_until' => $this->warranty_until?->format('Y-m-d'),
            'specs' => $this->specs ?? [],
            'is_loanable' => (bool) $this->is_loanable,
            'loan_blocked' => (bool) $this->loan_blocked,
            'loan_blocked_reason' => $this->loan_blocked_reason,

            // Relationships
            'owner_division' => $this->whenLoaded('ownerDivision', function () {
                return [
                    'id' => $this->ownerDivision->id,
                    'code' => $this->ownerDivision->code,
                    'name' => $this->ownerDivision->name,
                ];
            }),
            'category' => $this->whenLoaded('category', function () {
                return [
                    'id' => $this->category->id,
                    'code' => $this->category->code,
                    'name' => $this->category->name,
                    'category_type' => $this->category->category_type,
                ];
            }),
            'location' => $this->whenLoaded('location', function () {
                return [
                    'id' => $this->location->id,
                    'code' => $this->location->code,
                    'name' => $this->location->name,
                    'building' => $this->location->building,
                    'floor' => $this->location->floor,
                ];
            }),
            'assigned_user' => $this->whenLoaded('assignedUser', function () {
                return [
                    'id' => $this->assignedUser->id,
                    'name' => $this->assignedUser->name,
                    'email' => $this->assignedUser->email,
                ];
            }),
            'pic' => $this->whenLoaded('pic', function () {
                return [
                    'id' => $this->pic->id,
                    'name' => $this->pic->name,
                    'email' => $this->pic->email,
                ];
            }),
            'vendor' => $this->whenLoaded('vendor', function () {
                return [
                    'id' => $this->vendor->id,
                    'name' => $this->vendor->name,
                ];
            }),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
