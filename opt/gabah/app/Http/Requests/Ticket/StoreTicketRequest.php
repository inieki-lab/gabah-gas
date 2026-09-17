<?php

declare(strict_types=1);

namespace App\Http\Requests\Ticket;

use App\Enums\TicketPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'min:5', 'max:200'],
            'description' => ['required', 'string', 'min:10'],
            'category' => ['required', 'string', 'in:IT,General,License,Facility'],
            'priority' => ['required', new Enum(TicketPriority::class)],
            'type' => ['nullable', 'string', 'in:incident,request,maintenance'],
            'asset_id' => ['nullable', 'exists:assets,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'subject.required' => 'Subjek tiket keluhan/permintaan wajib diisi.',
            'description.required' => 'Deskripsi kendala atau permintaan wajib diisi.',
            'category.required' => 'Kategori tiket wajib dipilih.',
            'priority.required' => 'Tingkat prioritas tiket wajib ditentukan.',
        ];
    }
}
