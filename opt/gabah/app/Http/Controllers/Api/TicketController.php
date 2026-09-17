<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Ticket\StoreTicketRequest;
use App\Models\Ticket;
use App\Services\TicketSlaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Thin API Controller: Delegate SLA & Routing logic to TicketSlaService
 */
class TicketController extends Controller
{
    public function __construct(
        protected TicketSlaService $ticketService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Ticket::with(['asset', 'requester', 'assignee', 'approver'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->query('priority'));
        }

        if ($request->boolean('over_sla')) {
            $query->where('is_over_sla', true);
        }

        return response()->json($query->paginate($request->integer('per_page', 15)));
    }

    public function store(StoreTicketRequest $request): JsonResponse
    {
        $ticket = $this->ticketService->createTicket(
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'message' => 'Tiket kendala berhasil dibuat.',
            'data' => $ticket->load(['requester', 'asset']),
        ], 201);
    }

    public function show(Ticket $ticket): JsonResponse
    {
        $this->ticketService->checkAndUpdateOverSla($ticket);

        return response()->json([
            'data' => $ticket->load(['asset', 'requester', 'assignee', 'approver']),
        ]);
    }
}
