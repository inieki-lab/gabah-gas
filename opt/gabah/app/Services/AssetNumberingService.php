<?php

namespace App\Services;

use App\Models\AssetNumberSequence;
use App\Models\Division;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AssetNumberingService
{
    public const MIN_PADDING = 4;

    /**
     * Generate authoritative, concurrency-safe, immutable asset number.
     * Format: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
     *
     * @param int $ownerDivisionId ID divisi pemilik (IT, GA, SC, PIBC)
     * @param string $assetCode Kode aset (HLT, HPC, INV-F, MSN, etc)
     * @param int|null $year Tahun penomoran (default current year)
     * @return string
     *
     * @throws InvalidArgumentException
     */
    public function generateNumber(int $ownerDivisionId, string $assetCode, ?int $year = null): string
    {
        $year = $year ?? (int) date('Y');
        $assetCode = strtoupper(trim($assetCode));

        if (empty($assetCode)) {
            throw new InvalidArgumentException('Asset code must not be empty.');
        }

        $division = Division::find($ownerDivisionId);
        if (! $division) {
            throw new InvalidArgumentException("Division with ID {$ownerDivisionId} does not exist.");
        }

        $divisionCode = strtoupper($division->code);

        // Pessimistic row locking on sequence record per (division, asset_code, year)
        return DB::transaction(function () use ($ownerDivisionId, $divisionCode, $assetCode, $year) {
            // First ensure sequence row exists atomically
            $sequence = AssetNumberSequence::where('owner_division_id', $ownerDivisionId)
                ->where('asset_code', $assetCode)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if (! $sequence) {
                // Atomic insert-or-ignore / firstOrCreate to prevent race condition on first yearly sequence
                $sequence = AssetNumberSequence::firstOrCreate(
                    [
                        'owner_division_id' => $ownerDivisionId,
                        'asset_code' => $assetCode,
                        'year' => $year,
                    ],
                    [
                        'last_number' => 0,
                    ]
                );

                // Lock row explicitly after creation
                $sequence = AssetNumberSequence::where('id', $sequence->id)->lockForUpdate()->first();
            }

            // Increment sequence atomically
            $sequence->last_number += 1;
            $sequence->save();

            return $this->formatAssetNumber($divisionCode, $assetCode, $year, $sequence->last_number);
        }, 5);
    }

    /**
     * Format the asset number according to official GABAH business rules.
     */
    public function formatAssetNumber(string $divisionCode, string $assetCode, int $year, int $sequenceNumber): string
    {
        $padding = max(self::MIN_PADDING, strlen((string) $sequenceNumber));
        $formattedSequence = str_pad((string) $sequenceNumber, $padding, '0', STR_PAD_LEFT);

        return sprintf('%s-%s-%d-%s', $divisionCode, $assetCode, $year, $formattedSequence);
    }
}
