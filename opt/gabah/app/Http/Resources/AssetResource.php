<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'asset_number' => $this->asset_number,
            'name' => $this->name,
            'serial_number' => $this->serial_number,
            'hostname' => $this->hostname,
            'ip_address' => $this->ip_address,
            'category_type' => $this->category_type->value,
            'category' => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'code' => $this->category?->code,
            ],
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'location' => $this->location,
            'assigned_to' => $this->assignedUser ? [
                'id' => $this->assignedUser->id,
                'name' => $this->assignedUser->name,
                'email' => $this->assignedUser->email,
            ] : null,
            'vendor' => $this->vendor ? [
                'id' => $this->vendor->id,
                'name' => $this->vendor->name,
            ] : null,
            'purchase_date' => $this->purchase_date?->format('Y-m-d'),
            'warranty_until' => $this->warranty_until?->format('Y-m-d'),
            'price' => (float) $this->price,
            'custom_attributes' => $this->custom_attributes,
            'qr_code_url' => $this->qr_code_url,
            'is_loanable' => (bool) $this->is_loanable,
            'loan_blocked' => (bool) $this->loan_blocked,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
