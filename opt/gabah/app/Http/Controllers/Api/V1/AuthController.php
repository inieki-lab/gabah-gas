<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Handle API user login and token generation.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_name' => 'nullable|string',
        ]);

        $user = User::with(['division', 'department', 'roles'])->where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Kredensial email atau password yang Anda masukkan tidak sesuai.'],
            ]);
        }

        if (! $user->is_active) {
            return ApiResponse::error(
                'Akun Anda saat ini tidak aktif. Silakan hubungi Administrator GABAH.',
                null,
                Response::HTTP_FORBIDDEN
            );
        }

        $deviceName = $validated['device_name'] ?? 'gabah-api-client';
        $token = $user->createToken($deviceName)->plainTextToken;

        return ApiResponse::success([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'division' => $user->division ? [
                    'id' => $user->division->id,
                    'code' => $user->division->code,
                    'name' => $user->division->name,
                ] : null,
                'department' => $user->department ? [
                    'id' => $user->department->id,
                    'code' => $user->department->code,
                    'name' => $user->department->name,
                ] : null,
                'roles' => $user->roles->pluck('name'),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ], 'Login berhasil.');
    }

    /**
     * Get authenticated user profile with roles and division.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['division', 'department', 'roles']);

        return ApiResponse::success([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'division' => $user->division ? [
                'id' => $user->division->id,
                'code' => $user->division->code,
                'name' => $user->division->name,
            ] : null,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'code' => $user->department->code,
                'name' => $user->department->name,
            ] : null,
            'roles' => $user->roles->pluck('name'),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ], 'Profil pengguna aktif.');
    }

    /**
     * Handle API logout by revoking current access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return ApiResponse::success(null, 'Berhasil keluar dari sesi aplikasi.');
    }
}
