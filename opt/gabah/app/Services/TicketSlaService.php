<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TicketSlaService
{
    public function __construct(
        protected AuditLogService $auditLogService
    ) {}

    /**
     * Hitung deadline SLA respon dan resolusi
     */
    public function calculateDeadlines(TicketPriority $priority, ?Carbon $createdAt = null): array
    {
        $baseTime = $createdAt ?? now();

        $responseHours = match ($priority) {
            TicketPriority::URGENT => 1,
            TicketPriority::HIGH => 2,
            TicketPriority::MEDIUM => 4,
            TicketPriority::LOW => 8,
        };

        $resolutionHours = $priority->defaultSlaHours();

        return [
            'sla_response_deadline' => (clone $baseTime)->addHours($responseHours),
            'sla_resolution_deadline' => (clone $baseTime)->addHours($resolutionHours),
        ];
    }

    /**
     * Membuat Tiket Helpdesk Baru dengan SLA otomatis
     */
    public function createTicket(User $requester, array $data): Ticket
    {
        return DB::transaction(function () use ($requester, $data) {
            $priority = TicketPriority::from($data['priority'] ?? 'medium');
            $deadlines = $this->calculateDeadlines($priority);

            $year = now()->format('y');
            $count = Ticket::whereYear('created_at', now()->year)->count() + 1;
            $ticketNumber = sprintf('TKT-%s-%04d', $year, $count);

            $ticket = Ticket::create([
                'ticket_number' => $ticketNumber,
                'type' => $data['type'] ?? 'incident',
                'subject' => $data['subject'],
                'description' => $data['description'],
                'status' => TicketStatus::OPEN->value,
                'priority' => $priority->value,
                'sla_response_deadline' => $deadlines['sla_response_deadline'],
                'sla_resolution_deadline' => $deadlines['sla_resolution_deadline'],
                'is_over_sla' => false,
                'asset_id' => $data['asset_id'] ?? null,
                'requester_id' => $requester->id,
                'assignee_id' => $data['assignee_id'] ?? null,
                'category' => $data['category'] ?? 'IT',
                'approval_status' => $data['approval_status'] ?? 'not_required',
            ]);

            $this->auditLogService->log(
                $requester->id,
                'TICKET_CREATE',
                Ticket::class,
                $ticket->id,
                null,
                $ticket->toArray()
            );

            return $ticket;
        });
    }

    /**
     * Periksa status SLA tiket (overdue check)
     */
    public function checkAndUpdateOverSla(Ticket $ticket): bool
    {
        if (in_array($ticket->status, [TicketStatus::RESOLVED, TicketStatus::CLOSED])) {
            return false;
        }

        if ($ticket->sla_resolution_deadline && now()->gt($ticket->sla_resolution_deadline)) {
            if (! $ticket->is_over_sla) {
                $ticket->update(['is_over_sla' => true]);
            }
            return true;
        }

        return false;
    }
}
