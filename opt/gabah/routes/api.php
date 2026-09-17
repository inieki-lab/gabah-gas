<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\MasterDataController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\TicketController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| GABAH REST API Routes (Laravel 11) - Version 1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // Public Auth
    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');

    // Authenticated Scope
    Route::middleware('auth:sanctum')->group(function () {

        // Session & Identity
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');

        // Master Data & Organization
        Route::get('/master/divisions', [MasterDataController::class, 'divisions'])->name('api.v1.master.divisions');
        Route::get('/master/departments', [MasterDataController::class, 'departments'])->name('api.v1.master.departments');
        Route::get('/master/locations', [MasterDataController::class, 'locations'])->name('api.v1.master.locations');
        Route::get('/master/asset-categories', [MasterDataController::class, 'assetCategories'])->name('api.v1.master.categories');

        // Core Assets Management
        Route::get('/assets', [AssetController::class, 'index'])->name('api.v1.assets.index');
        Route::post('/assets', [AssetController::class, 'store'])->name('api.v1.assets.store');
        Route::get('/assets/{asset}', [AssetController::class, 'show'])->name('api.v1.assets.show');
        Route::put('/assets/{asset}', [AssetController::class, 'update'])->name('api.v1.assets.update');
        Route::post('/assets/{asset}/assign', [AssetController::class, 'assign'])->name('api.v1.assets.assign');
        Route::post('/assets/{asset}/move', [AssetController::class, 'move'])->name('api.v1.assets.move');
        Route::get('/assets/{asset}/history', [AssetController::class, 'history'])->name('api.v1.assets.history');
        Route::get('/assets/{asset_number}/qr', [AssetController::class, 'qrCode'])->name('api.v1.assets.show-qr');

        // Loans & Anti-Collision
        Route::get('/loans', [LoanController::class, 'index'])->name('api.v1.loans.index');
        Route::post('/loans', [LoanController::class, 'store'])->name('api.v1.loans.store');
        Route::post('/loans/{loan}/approve', [LoanController::class, 'approve'])->name('api.v1.loans.approve');
        Route::post('/loans/{loan}/handover', [LoanController::class, 'handover'])->name('api.v1.loans.handover');
        Route::post('/loans/{loan}/return', [LoanController::class, 'returnAsset'])->name('api.v1.loans.return');

        // Helpdesk & SLA Tickets
        Route::get('/tickets', [TicketController::class, 'index'])->name('api.v1.tickets.index');
        Route::post('/tickets', [TicketController::class, 'store'])->name('api.v1.tickets.store');
        Route::get('/tickets/{ticket}', [TicketController::class, 'show'])->name('api.v1.tickets.show');
    });
});
