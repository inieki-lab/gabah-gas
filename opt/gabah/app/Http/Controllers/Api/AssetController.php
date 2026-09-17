<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\AssignAssetRequest;
use App\Http\Requests\Asset\MoveAssetRequest;
use App\Http\Requests\Asset\StoreAssetRequest;
use App\Http\Requests\Asset\UpdateAssetRequest;
use App\Http\Resources\V1\AssetResource;
use App\Models\Asset;
use App\Services\AssetService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Symfony\Component\HttpFoundation\Response;

class AssetController extends Controller
{
    public function __construct(
        protected AssetService $assetService
    ) {}

    /**
     * List all assets with search, division scoping, and filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Asset::class);

        $query = Asset::with([
            'ownerDivision',
            'category',
            'location',
            'assignedUser',
            'pic',
            'vendor',
        ]);

        // Filter by Owner Division
        if ($request->filled('owner_division_id')) {
            $query->where('owner_division_id', $request->query('owner_division_id'));
        }

        // Filter by Category
        if ($request->filled('asset_category_id')) {
            $query->where('asset_category_id', $request->query('asset_category_id'));
        }

        // Filter by Status & Condition
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('condition')) {
            $query->where('condition', $request->query('condition'));
        }

        // Global Search
        if ($request->filled('search')) {
            $search = trim((string) $request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ILIKE', "%{$search}%")
                  ->orWhere('asset_number', 'ILIKE', "%{$search}%")
                  ->orWhere('corporate_asset_number', 'ILIKE', "%{$search}%")
                  ->orWhere('serial_number', 'ILIKE', "%{$search}%")
                  ->orWhere('hostname', 'ILIKE', "%{$search}%")
                  ->orWhere('brand', 'ILIKE', "%{$search}%");
            });
        }

        $assets = $query->latest('id')->paginate($request->integer('per_page', 15));

        return ApiResponse::success([
            'items' => AssetResource::collection($assets->items()),
            'pagination' => [
                'current_page' => $assets->currentPage(),
                'last_page' => $assets->lastPage(),
                'per_page' => $assets->perPage(),
                'total' => $assets->total(),
            ],
        ], 'Daftar aset berhasil dimuat.');
    }

    /**
     * Register a new asset with automatic authoritative numbering.
     */
    public function store(StoreAssetRequest $request): JsonResponse
    {
        $category = \App\Models\AssetCategory::findOrFail($request->validated('asset_category_id'));
        $ownerDivisionId = $category->owner_division_id ? (int) $category->owner_division_id : (int) $request->validated('owner_division_id');

        $this->authorize('create', [Asset::class, $ownerDivisionId]);

        $asset = $this->assetService->createAsset(
            $request->validated(),
            $request->user()
        );

        $asset->load(['ownerDivision', 'category', 'location', 'assignedUser', 'pic', 'vendor']);

        return ApiResponse::success(
            new AssetResource($asset),
            'Aset berhasil didaftarkan dengan nomor resmi.',
            Response::HTTP_CREATED
        );
    }

    /**
     * Show single asset details.
     */
    public function show(Asset $asset): JsonResponse
    {
        $this->authorize('view', $asset);

        $asset->load([
            'ownerDivision',
            'category',
            'location',
            'assignedUser',
            'pic',
            'vendor',
            'assignments.user',
            'assignments.assigner',
            'movements.fromLocation',
            'movements.toLocation',
            'movements.mover',
            'loans.borrower',
            'tickets.requester',
        ]);

        return ApiResponse::success(new AssetResource($asset), 'Detail aset.');
    }

    /**
     * Update asset attributes (strictly protects immutability of asset_number & owner_division).
     */
    public function update(UpdateAssetRequest $request, Asset $asset): JsonResponse
    {
        $this->authorize('update', $asset);

        $updated = $this->assetService->updateAsset($asset, $request->validated(), $request->user());
        $updated->load(['ownerDivision', 'category', 'location', 'assignedUser', 'pic', 'vendor']);

        return ApiResponse::success(new AssetResource($updated), 'Data aset berhasil diperbarui.');
    }

    /**
     * Assign / Handover Custodian.
     */
    public function assign(AssignAssetRequest $request, Asset $asset): JsonResponse
    {
        $this->authorize('update', $asset);

        $assignment = $this->assetService->assignCustodian(
            $asset,
            (int) $request->validated('user_id'),
            $request->validated('notes'),
            $request->user()
        );

        $asset->load(['assignedUser', 'assignments.user']);

        return ApiResponse::success([
            'asset' => new AssetResource($asset),
            'assignment' => $assignment->load(['user', 'assigner']),
        ], 'Serah terima pemegang aset (custodian) berhasil dicatat.');
    }

    /**
     * Move Physical Location.
     */
    public function move(MoveAssetRequest $request, Asset $asset): JsonResponse
    {
        $this->authorize('update', $asset);

        $movement = $this->assetService->moveLocation(
            $asset,
            (int) $request->validated('to_location_id'),
            $request->validated('reason'),
            $request->user()
        );

        $asset->load(['location', 'movements.toLocation']);

        return ApiResponse::success([
            'asset' => new AssetResource($asset),
            'movement' => $movement->load(['fromLocation', 'toLocation', 'mover']),
        ], 'Pemindahan lokasi fisik aset berhasil dicatat.');
    }

    /**
     * Comprehensive Asset Mutation & Ticket History.
     */
    public function history(Asset $asset): JsonResponse
    {
        $this->authorize('view', $asset);

        $assignments = $asset->assignments()->with(['user', 'assigner'])->get();
        $movements = $asset->movements()->with(['fromLocation', 'toLocation', 'mover'])->get();
        $loans = $asset->loans()->with(['borrower', 'approver'])->get();
        $tickets = $asset->tickets()->with(['requester', 'technician'])->get();

        return ApiResponse::success([
            'asset_number' => $asset->asset_number,
            'corporate_asset_number' => $asset->corporate_asset_number,
            'name' => $asset->name,
            'assignments_history' => $assignments,
            'movements_history' => $movements,
            'loans_history' => $loans,
            'tickets_history' => $tickets,
        ], 'Riwayat mutasi dan operasional aset.');
    }

    /**
     * Generate QR code barcode for scanning and labeling.
     */
    public function qrCode(string $assetNumber)
    {
        $asset = Asset::where('asset_number', $assetNumber)->firstOrFail();
        $this->authorize('view', $asset);

        $qrPayload = json_encode([
            'asset_number' => $asset->asset_number,
            'corporate_asset_number' => $asset->corporate_asset_number,
            'name' => $asset->name,
            'owner_division' => $asset->ownerDivision?->code,
            'serial_number' => $asset->serial_number,
        ]);

        return response(QrCode::format('png')->size(300)->generate($qrPayload))
            ->header('Content-Type', 'image/png');
    }
}
