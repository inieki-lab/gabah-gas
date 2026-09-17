<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_number' => $this->ticket_number,
            'type' => $this->type,
            'subject' => $this->subject,
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'sla_response_deadline' => $this->sla_response_deadline?->toIso8601String(),
            'sla_resolution_deadline' => $this->sla_resolution_deadline?->toIso8601String(),
            'is_over_sla' => (bool) $this->is_over_sla,
            'asset' => $this->asset ? [
                'id' => $this->asset->id,
                'asset_number' => $this->asset->asset_number,
                'name' => $this->asset->name,
            ] : null,
            'requester' => [
                'id' => $this->requester->id,
                'name' => $this->requester->name,
                'email' => $this->requester->email,
            ],
            'assignee' => $this->assignee ? [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
                'email' => $this->assignee->email,
            ] : null,
            'category' => $this->category,
            'approval_status' => $this->approval_status,
            'approved_by' => $this->approver ? ['id' => $this->approver->id, 'name' => $this->approver->name] : null,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
