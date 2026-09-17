<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Loan\StoreLoanRequest;
use App\Models\Loan;
use App\Services\LoanReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Thin API Controller: Delegate Anti-Bentrok & Transactions to LoanReservationService
 */
class LoanController extends Controller
{
    public function __construct(
        protected LoanReservationService $loanService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Loan::with(['asset', 'borrower', 'approver', 'receiver'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('asset_id')) {
            $query->where('asset_id', $request->query('asset_id'));
        }

        return response()->json($query->paginate($request->integer('per_page', 15)));
    }

    public function store(StoreLoanRequest $request): JsonResponse
    {
        $loan = $this->loanService->createReservation(
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'message' => 'Reservasi peminjaman berhasil diajukan.',
            'data' => $loan->load(['asset', 'borrower']),
        ], 201);
    }

    public function approve(Loan $loan, Request $request): JsonResponse
    {
        $this->authorize('approve', $loan);

        $approvedLoan = $this->loanService->approveReservation($loan, $request->user());

        return response()->json([
            'message' => 'Reservasi peminjaman berhasil disetujui.',
            'data' => $approvedLoan->load(['asset', 'borrower', 'approver']),
        ]);
    }

    public function handover(Loan $loan, Request $request): JsonResponse
    {
        $this->authorize('handover', $loan);

        $activeLoan = $this->loanService->handoverAsset($loan, $request->user());

        return response()->json([
            'message' => 'Serah terima aset berhasil diproses.',
            'data' => $activeLoan,
        ]);
    }

    public function returnAsset(Loan $loan, Request $request): JsonResponse
    {
        $this->authorize('return', $loan);

        $returnedLoan = $this->loanService->returnAsset(
            $loan,
            $request->user(),
            $request->validate(['notes' => 'nullable|string|max:500'])
        );

        return response()->json([
            'message' => 'Aset berhasil dikembalikan.',
            'data' => $returnedLoan,
        ]);
    }
}
