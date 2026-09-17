<?php

declare(strict_types=1);

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorize will be checked via AssetPolicy in Controller
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'corporate_asset_number' => ['nullable', 'string', 'max:50'],
            'hostname' => ['nullable', 'string', 'max:100'],
            'ip_address' => ['nullable', 'ip'],
            'mac_address' => ['nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'required', 'in:available,in_use,loaned,maintenance,disposed'],
            'condition' => ['sometimes', 'required', 'in:good,fair,damaged'],
            'purchase_date' => ['nullable', 'date'],
            'warranty_until' => ['nullable', 'date'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'specs' => ['nullable', 'array'],
            'is_loanable' => ['boolean'],
            'loan_blocked' => ['boolean'],
            'loan_blocked_reason' => ['nullable', 'string', 'max:255'],
            'pic_user_id' => ['nullable', 'exists:users,id'],
            'vendor_id' => ['nullable', 'exists:vendors,id'],
        ];
    }

    /**
     * Strict rule: IMMUTABILITY OF ASSET NUMBER & OWNER DIVISION.
     * Clients cannot change asset_number or owner_division_id via regular update.
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated($key, $default);
        if (is_array($validated)) {
            unset($validated['asset_number']);
            unset($validated['owner_division_id']);
        }
        return $validated;
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama atau deskripsi unit aset tidak boleh kosong.',
            'ip_address.ip' => 'Format IP Address tidak valid (IPv4/IPv6).',
            'price.min' => 'Harga perolehan tidak boleh bernilai negatif.',
        ];
    }
}
