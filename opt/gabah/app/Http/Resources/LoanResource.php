<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'loan_number' => $this->loan_number,
            'asset_id' => $this->asset_id,
            'asset' => $this->asset ? [
                'id' => $this->asset->id,
                'asset_number' => $this->asset->asset_number,
                'name' => $this->asset->name,
                'category_type' => $this->asset->category_type?->value,
            ] : null,
            'borrower' => [
                'id' => $this->borrower->id,
                'name' => $this->borrower->name,
                'email' => $this->borrower->email,
            ],
            'purpose' => $this->purpose,
            'loan_date' => $this->loan_date->toIso8601String(),
            'due_date' => $this->due_date->toIso8601String(),
            'returned_at' => $this->returned_at?->toIso8601String(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'approver' => $this->approver ? ['id' => $this->approver->id, 'name' => $this->approver->name] : null,
            'receiver' => $this->receiver ? ['id' => $this->receiver->id, 'name' => $this->receiver->name] : null,
            'notes' => $this->notes,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
