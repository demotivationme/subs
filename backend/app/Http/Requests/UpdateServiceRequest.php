<?php

namespace App\Http\Requests;

use App\Data\ServiceChanges;
use Illuminate\Foundation\Http\FormRequest;

class UpdateServiceRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:100'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    public function toInput(): ServiceChanges
    {
        return new ServiceChanges($this->validated());
    }
}
