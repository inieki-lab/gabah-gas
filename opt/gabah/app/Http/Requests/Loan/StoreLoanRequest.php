<?php

declare(strict_types=1);

namespace App\Http\Requests\Loan;

use Illuminate\Foundation\Http\FormRequest;

class StoreLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'asset_id' => ['required', 'exists:assets,id'],
            'purpose' => ['required', 'string', 'min:5', 'max:1000'],
            'loan_date' => ['required', 'date', 'after_or_equal:now'],
            'due_date' => ['required', 'date', 'after:loan_date'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'asset_id.required' => 'Pilih aset yang ingin dipinjam.',
            'asset_id.exists' => 'Aset tidak ditemukan dalam database.',
            'purpose.required' => 'Tujuan peminjaman wajib dijelaskan secara rinci.',
            'loan_date.required' => 'Tanggal dan waktu mulai peminjaman wajib diisi.',
            'loan_date.after_or_equal' => 'Waktu peminjaman tidak boleh di masa lalu.',
            'due_date.required' => 'Tanggal dan waktu estimasi pengembalian wajib diisi.',
            'due_date.after' => 'Waktu pengembalian harus setelah waktu mulai peminjaman.',
        ];
    }
}
