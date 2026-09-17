<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\AuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckAssetExpirations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'assets:check-expirations {--days=30 : Ambang batas hari untuk peringatan garansi}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Pemeriksaan berkala masa berlaku garansi hardware dan perpanjangan lisensi aset';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) $this->option('days');
        $this->info("Memindai aset dengan masa garansi berakhir dalam kurun {$days} hari ke depan...");

        $now = now();
        $targetDate = now()->addDays($days);

        // Check assets where warranty_until is approaching
        $expiringAssets = Asset::whereNotNull('warranty_until')
            ->whereBetween('warranty_until', [$now, $targetDate])
            ->with(['ownerDivision', 'category'])
            ->get();

        $this->line("Hasil Pemindaian:");
        $this->line("- Aset Menjelang Akhir Garansi: {$expiringAssets->count()} unit");

        foreach ($expiringAssets as $asset) {
            $daysLeft = (int) $now->diffInDays($asset->warranty_until);
            $divisionCode = $asset->ownerDivision?->code ?? 'N/A';
            $this->warn("  * [WARRANTY ALERT] [{$divisionCode}] {$asset->asset_number} - {$asset->name} (Sisa {$daysLeft} hari garansi)");
        }

        $this->info('Pemindaian garansi aset selesai.');
        return Command::SUCCESS;
    }
}
