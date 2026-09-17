<?php

namespace Tests\Feature;

use App\Enums\CategoryType;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetNumberSequence;
use App\Models\User;
use App\Services\AssetNumberingService;
use App\Services\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;

class AssetNumberingTest extends TestCase
{
    use RefreshDatabase;

    protected AssetNumberingService $numberingService;
    protected AssetService $assetService;
    protected AssetCategory $laptopCategory;
    protected AssetCategory $pcCategory;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->numberingService = app(AssetNumberingService::class);
        $this->assetService = app(AssetService::class);

        $this->user = User::factory()->create();

        $this->laptopCategory = AssetCategory::create([
            'code' => 'HLT',
            'name' => 'Laptop',
            'category_type' => CategoryType::IT,
            'is_active' => true,
        ]);

        $this->pcCategory = AssetCategory::create([
            'code' => 'HPC',
            'name' => 'Desktop PC',
            'category_type' => CategoryType::IT,
            'is_active' => true,
        ]);

        $this->serverCategory = AssetCategory::create([
            'code' => 'HSV',
            'name' => 'Server',
            'category_type' => CategoryType::IT,
            'is_active' => true,
        ]);

        $this->furnitureCategory = AssetCategory::create([
            'code' => 'INV-F',
            'name' => 'Furniture',
            'category_type' => CategoryType::GENERAL,
            'is_active' => true,
        ]);

        $this->machineCategory = AssetCategory::create([
            'code' => 'MSN',
            'name' => 'Mesin',
            'category_type' => CategoryType::GENERAL,
            'is_active' => true,
        ]);
    }

    /**
     * Mandatory Suite Test: Verify Cross-Division Sequence Matrix
     * IT-HLT-2026-0001
     * IT-HLT-2026-0002
     * IT-HPC-2026-0001
     * IT-HSV-2026-0001
     * GA-INV-F-2026-0001
     * GA-INV-F-2026-0002
     * SC-MSN-2026-0001
     * IT-HLT-2027-0001
     */
    public function test_mandatory_matrix_numbering_verification(): void
    {
        // 1. IT-HLT-2026-0001
        $hlt1 = $this->numberingService->generate($this->laptopCategory, 2026);
        $this->assertEquals('IT-HLT-2026-0001', $hlt1);

        // 2. IT-HLT-2026-0002
        $hlt2 = $this->numberingService->generate($this->laptopCategory, 2026);
        $this->assertEquals('IT-HLT-2026-0002', $hlt2);

        // 3. IT-HPC-2026-0001
        $hpc1 = $this->numberingService->generate($this->pcCategory, 2026);
        $this->assertEquals('IT-HPC-2026-0001', $hpc1);

        // 4. IT-HSV-2026-0001
        $hsv1 = $this->numberingService->generate($this->serverCategory, 2026);
        $this->assertEquals('IT-HSV-2026-0001', $hsv1);

        // 5. GA-INV-F-2026-0001
        $invf1 = $this->numberingService->generate($this->furnitureCategory, 2026);
        $this->assertEquals('GA-INV-F-2026-0001', $invf1);

        // 6. GA-INV-F-2026-0002
        $invf2 = $this->numberingService->generate($this->furnitureCategory, 2026);
        $this->assertEquals('GA-INV-F-2026-0002', $invf2);

        // 7. SC-MSN-2026-0001
        $msn1 = $this->numberingService->generate($this->machineCategory, 2026);
        $this->assertEquals('SC-MSN-2026-0001', $msn1);

        // 8. IT-HLT-2027-0001 (Yearly Reset)
        $hlt2027 = $this->numberingService->generate($this->laptopCategory, 2027);
        $this->assertEquals('IT-HLT-2027-0001', $hlt2027);
    }

    /**
     * Test 1 — First asset generation
     * Input: Laptop, 2026 -> Expected: IT-HLT-2026-0001
     */
    public function test_first_asset_number_generation(): void
    {
        $number = $this->numberingService->generate($this->laptopCategory, 2026);

        $this->assertEquals('IT-HLT-2026-0001', $number);

        $sequence = AssetNumberSequence::where('category_code', 'HLT')
            ->where('year', 2026)
            ->first();

        $this->assertNotNull($sequence);
        $this->assertEquals(1, $sequence->last_number);
    }

    /**
     * Test 2 — Second asset sequential increment
     * Expected: IT-HLT-2026-0002
     */
    public function test_second_asset_sequential_increment(): void
    {
        $num1 = $this->numberingService->generate($this->laptopCategory, 2026);
        $num2 = $this->numberingService->generate($this->laptopCategory, 2026);

        $this->assertEquals('IT-HLT-2026-0001', $num1);
        $this->assertEquals('IT-HLT-2026-0002', $num2);
    }

    /**
     * Test 3 — Different category has isolated sequence
     * Laptop: IT-HLT-2026-0001
     * PC: IT-HPC-2026-0001
     */
    public function test_different_category_has_isolated_sequence(): void
    {
        $laptopNum = $this->numberingService->generate($this->laptopCategory, 2026);
        $pcNum = $this->numberingService->generate($this->pcCategory, 2026);

        $this->assertEquals('IT-HLT-2026-0001', $laptopNum);
        $this->assertEquals('IT-HPC-2026-0001', $pcNum);
    }

    /**
     * Test 4 — Different year resets sequence to 0001
     * Laptop 2026: IT-HLT-2026-0001
     * Laptop 2027: IT-HLT-2027-0001
     */
    public function test_different_year_resets_sequence(): void
    {
        $laptop2026 = $this->numberingService->generate($this->laptopCategory, 2026);
        $laptop2027 = $this->numberingService->generate($this->laptopCategory, 2027);

        $this->assertEquals('IT-HLT-2026-0001', $laptop2026);
        $this->assertEquals('IT-HLT-2027-0001', $laptop2027);
    }

    /**
     * Test 5 — Edit asset does not alter asset code
     */
    public function test_editing_asset_does_not_change_asset_number(): void
    {
        $asset = $this->assetService->createAsset([
            'name' => 'ThinkPad X1 Carbon',
            'asset_category_id' => $this->laptopCategory->id,
            'location' => 'Lantai 2 - Ruang IT',
        ], $this->user);

        $originalNumber = $asset->asset_number;
        $this->assertStringStartsWith('IT-HLT-', $originalNumber);

        // Attempt update with attempted asset_number alteration and location move
        $updated = $this->assetService->updateAsset($asset, [
            'name' => 'ThinkPad X1 Carbon (Upgraded RAM)',
            'location' => 'Lantai 5 - Finance',
            'asset_number' => 'IT-MODIFIED-9999',
        ], $this->user);

        $this->assertEquals($originalNumber, $updated->asset_number);
        $this->assertEquals('Lantai 5 - Finance', $updated->location);
    }

    /**
     * Test 6 — Delete/retire does not cause number to be reused
     */
    public function test_deleting_asset_does_not_reuse_sequence_number(): void
    {
        $asset1 = $this->assetService->createAsset([
            'name' => 'ThinkPad T14 Gen 1',
            'asset_category_id' => $this->laptopCategory->id,
            'location' => 'HQ',
        ], $this->user);

        $firstNumber = $asset1->asset_number;

        // Delete asset1
        $asset1->delete();

        // Create asset2
        $asset2 = $this->assetService->createAsset([
            'name' => 'ThinkPad T14 Gen 2',
            'asset_category_id' => $this->laptopCategory->id,
            'location' => 'HQ',
        ], $this->user);

        $this->assertNotEquals($firstNumber, $asset2->asset_number);
        $this->assertEquals(2, (int) substr($asset2->asset_number, -4));
    }

    /**
     * Test 7 — Database unique constraint protects against duplicate numbering
     */
    public function test_database_unique_constraint_enforced(): void
    {
        Asset::create([
            'asset_number' => 'IT-HLT-2026-0001',
            'name' => 'Laptop A',
            'asset_category_id' => $this->laptopCategory->id,
            'category_type' => CategoryType::IT->value,
            'location' => 'Office',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        Asset::create([
            'asset_number' => 'IT-HLT-2026-0001',
            'name' => 'Duplicate Laptop B',
            'asset_category_id' => $this->laptopCategory->id,
            'category_type' => CategoryType::IT->value,
            'location' => 'Office',
        ]);
    }

    /**
     * Test 8 — Category without code throws clear exception
     */
    public function test_category_without_code_throws_exception(): void
    {
        $invalidCategory = AssetCategory::create([
            'code' => '',
            'name' => 'Unconfigured Hardware',
            'category_type' => CategoryType::IT,
            'is_active' => true,
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Asset category code is not configured');

        $this->numberingService->generate($invalidCategory, 2026);
    }

    /**
     * Test 9 — Invalid client-supplied asset_code is ignored
     */
    public function test_client_supplied_asset_number_is_ignored_and_overridden(): void
    {
        $asset = $this->assetService->createAsset([
            'asset_number' => 'IT-CLIENT-HACK-9999',
            'name' => 'MacBook Pro M3',
            'asset_category_id' => $this->laptopCategory->id,
            'location' => 'IT Room',
        ], $this->user);

        $this->assertNotEquals('IT-CLIENT-HACK-9999', $asset->asset_number);
        $this->assertStringStartsWith('IT-HLT-', $asset->asset_number);
    }

    /**
     * Test 10 — Transaction rollback preserves consistency
     */
    public function test_transaction_rollback_maintains_clean_state(): void
    {
        $initialAssetCount = Asset::count();

        try {
            DB::transaction(function () {
                $this->assetService->createAsset([
                    'name' => 'Failing Asset',
                    'asset_category_id' => $this->laptopCategory->id,
                    'location' => 'Office',
                ]);

                // Deliberately trigger failure
                throw new \Exception('Forced Transaction Failure');
            });
        } catch (\Exception $e) {
            // Expected
        }

        $this->assertEquals($initialAssetCount, Asset::count());
    }
}
