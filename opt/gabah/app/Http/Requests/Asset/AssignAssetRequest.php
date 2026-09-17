<?php

declare(strict_types=1);

namespace App\Http\Requests\Asset;

use Illuminate\Foundation\Http\FormRequest;

class AssignAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'exists:users,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.required' => 'Karyawan pemegang (custodian) wajib dipilih.',
            'user_id.exists' => 'Data karyawan tidak ditemukan dalam sistem.',
        ];
    }
}
