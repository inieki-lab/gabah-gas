<?php

declare(strict_types=1);

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class MoveAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'to_location_id' => ['required', 'exists:locations,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'to_location_id.required' => 'Lokasi tujuan pemindahan aset wajib dipilih.',
            'to_location_id.exists' => 'Lokasi fisik tidak ditemukan dalam master data.',
        ];
    }
}
