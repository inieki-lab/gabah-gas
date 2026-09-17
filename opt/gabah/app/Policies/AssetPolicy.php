<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Asset;
use App\Models\Division;
use App\Models\User;

class AssetPolicy
{
    /**
     * Admin GABAH superuser bypasses all policy checks.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasRole('Admin GABAH')) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('assets.view') || $user->hasAnyRole([
            'Admin GABAH', 'Management', 'IT', 'GA', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor',
        ]);
    }

    public function view(User $user, Asset $asset): bool
    {
        if ($user->hasRole('Admin GABAH') || $user->hasRole('Management') || $user->hasRole('Auditor')) {
            return true;
        }

        // Karyawan can only view assets currently assigned to them or if loanable in their location
        if ($user->hasRole('Karyawan')) {
            return $asset->assigned_to === $user->id || $asset->is_loanable;
        }

        // Vendor can only view assets explicitly linked to their vendor id
        if ($user->hasRole('Vendor')) {
            return $asset->vendor_id !== null && $user->vendor_id === $asset->vendor_id;
        }

        // Division-scoped operators
        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Create permission checked against division ownership authority.
     */
    public function create(User $user, ?int $ownerDivisionId = null): bool
    {
        if (! $user->can('assets.create')) {
            return false;
        }

        if ($ownerDivisionId === null) {
            return $user->hasAnyRole(['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC']);
        }

        $division = Division::find($ownerDivisionId);
        if (! $division) {
            return false;
        }

        // Division-scoped authority
        return match (strtoupper($division->code)) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Update asset data within owner division scope.
     */
    public function update(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.update')) {
            return false;
        }

        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Assign asset to custodian/user.
     */
    public function assign(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.assign')) {
            return false;
        }

        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Move asset location or custodian.
     */
    public function move(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.move')) {
            return false;
        }

        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Propose or execute cannibalization / disposal / auction.
     */
    public function dispose(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.delete') && ! $user->hasAnyRole(['Admin GABAH', 'Management'])) {
            return false;
        }

        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }

    /**
     * Delete/archive asset strictly restricted to Division Lead or Admin GABAH.
     */
    public function delete(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.delete')) {
            return false;
        }

        $divisionCode = strtoupper($asset->ownerDivision?->code ?? '');

        return match ($divisionCode) {
            'IT' => $user->hasRole('IT'),
            'GA' => $user->hasRole('GA'),
            'SC' => $user->hasRole('Supply Chain'),
            'PIBC' => $user->hasRole('PIBC'),
            default => false,
        };
    }
}
