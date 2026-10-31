<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRequest extends FormRequest
{
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'name' => ['required', 'string', 'max:100'],
            'default_category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')
                ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId))],
        ];
    }
}
