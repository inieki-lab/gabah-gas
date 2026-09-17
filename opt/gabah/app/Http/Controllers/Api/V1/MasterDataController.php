<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AssetCategory;
use App\Models\Department;
use App\Models\Division;
use App\Models\Location;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MasterDataController extends Controller
{
    public function divisions(): JsonResponse
    {
        $divisions = Division::where('is_active', true)->with('departments')->get();
        return ApiResponse::success($divisions, 'Daftar divisi aktif.');
    }

    public function departments(Request $request): JsonResponse
    {
        $query = Department::where('is_active', true)->with('division');
        if ($request->has('division_id')) {
            $query->where('division_id', $request->query('division_id'));
        }
        return ApiResponse::success($query->get(), 'Daftar departemen.');
    }

    public function locations(): JsonResponse
    {
        $locations = Location::where('is_active', true)->get();
        return ApiResponse::success($locations, 'Daftar lokasi fisik.');
    }

    public function assetCategories(): JsonResponse
    {
        $categories = AssetCategory::where('is_active', true)->get();
        return ApiResponse::success($categories, 'Daftar kategori kode aset resmi.');
    }
}
