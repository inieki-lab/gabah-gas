<?php

namespace App\Console\Commands;

use App\Enums\TicketPriority;
use App\Models\AuditLog;
use App\Models\Ticket;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CheckTicketSla extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tickets:check-sla {--escalate : Auto-escalate priority on breach}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Pantau batas SLA Helpdesk dan eskalasikan tiket gangguan yang melewati target resolusi';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Memantau kepatuhan target SLA Helpdesk GABAH...');

        $now = now();
        $shouldEscalate = $this->option('escalate');

        // Check tickets breaching resolution SLA
        $breachedTickets = Ticket::whereIn('status', ['open', 'in_progress', 'pending'])
            ->whereNotNull('sla_resolution_deadline')
            ->where('sla_resolution_deadline', '<', $now)
            ->where('is_over_sla', false)
            ->with(['requester', 'assignee'])
            ->get();

        if ($breachedTickets->isEmpty()) {
            $this->info('Semua tiket aktif saat ini berada dalam batas aman SLA.');
            return Command::SUCCESS;
        }

        $this->warn("Terdeteksi {$breachedTickets->count()} tiket melewati batas waktu resolusi SLA. Memproses...");

        foreach ($breachedTickets as $ticket) {
            $overdueHours = round($now->diffInMinutes($ticket->sla_resolution_deadline) / 60, 1);
            $this->line("- [SLA BREACH] Tiket: {$ticket->ticket_number} | Judul: {$ticket->subject} | Priority: {$ticket->priority->value} | Terlambat {$overdueHours} jam");

            DB::transaction(function () use ($ticket, $overdueHours, $shouldEscalate, $now) {
                $updates = ['is_over_sla' => true];

                // Auto-escalation logic: bump priority if requested
                if ($shouldEscalate && $ticket->priority !== TicketPriority::URGENT) {
                    $nextPriority = match ($ticket->priority) {
                        TicketPriority::LOW => TicketPriority::MEDIUM,
                        TicketPriority::MEDIUM => TicketPriority::HIGH,
                        TicketPriority::HIGH => TicketPriority::URGENT,
                        default => $ticket->priority,
                    };

                    $updates['priority'] = $nextPriority;
                    $this->warn("  * Prioritas tiket {$ticket->ticket_number} dieskalasi menjadi {$nextPriority->value}");
                }

                $ticket->update($updates);

                AuditLog::create([
                    'user_id' => null, // Automated System Action
                    'action' => 'TICKET_SLA_BREACH',
                    'auditable_type' => Ticket::class,
                    'auditable_id' => $ticket->id,
                    'old_values' => ['is_over_sla' => false],
                    'new_values' => [
                        'is_over_sla' => true,
                        'overdue_hours' => $overdueHours,
                        'escalated' => $shouldEscalate,
                        'flagged_at' => $now->toIso8601String(),
                    ],
                    'ip_address' => '127.0.0.1',
                    'user_agent' => 'GABAH_CRON_SCHEDULER',
                    'created_at' => $now,
                ]);
            });
        }

        $this->info('Pemeriksaan kepatuhan SLA tiket selesai.');
        return Command::SUCCESS;
    }
}
