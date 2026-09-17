<?php

declare(strict_types=1);

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorize will be enforced via AssetPolicy in Controller
    }

    public function rules(): array
    {
        return [
            'owner_division_id' => ['nullable', 'exists:divisions,id'],
            'asset_category_id' => ['required', 'exists:asset_categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'corporate_asset_number' => ['nullable', 'string', 'max:50'],
            'hostname' => ['nullable', 'string', 'max:100'],
            'ip_address' => ['nullable', 'ip'],
            'mac_address' => ['nullable', 'string', 'max:50'],
            'location_id' => ['nullable', 'exists:locations,id'],
            'assigned_to_user_id' => ['nullable', 'exists:users,id'],
            'pic_user_id' => ['nullable', 'exists:users,id'],
            'vendor_id' => ['nullable', 'exists:vendors,id'],
            'status' => ['nullable', 'in:available,in_use,loaned,maintenance,disposed'],
            'condition' => ['nullable', 'in:good,fair,damaged'],
            'purchase_date' => ['nullable', 'date'],
            'warranty_until' => ['nullable', 'date', 'after_or_equal:purchase_date'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'specs' => ['nullable', 'array'],
            'is_loanable' => ['boolean'],
        ];
    }

    /**
     * Strict rule: client-supplied asset_number is ALWAYS ignored.
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated($key, $default);
        if (is_array($validated)) {
            unset($validated['asset_number']);
        }
        return $validated;
    }

    public function messages(): array
    {
        return [
            'owner_division_id.required' => 'Divisi pemilik aset wajib ditentukan.',
            'owner_division_id.exists' => 'Divisi pemilik aset tidak terdaftar.',
            'asset_category_id.required' => 'Kategori kode aset wajib dipilih.',
            'asset_category_id.exists' => 'Kategori aset tidak ditemukan dalam sistem.',
            'name.required' => 'Nama atau deskripsi unit aset wajib diisi.',
            'ip_address.ip' => 'Format IP Address tidak valid (IPv4/IPv6).',
            'warranty_until.after_or_equal' => 'Tanggal akhir garansi tidak boleh sebelum tanggal pembelian.',
            'price.min' => 'Harga perolehan tidak boleh bernilai negatif.',
        ];
    }
}
