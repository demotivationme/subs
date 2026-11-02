<?php

namespace App\Http\Requests;

use App\Data\ServiceInput;
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
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    public function toInput(): ServiceInput
    {
        return new ServiceInput(
            name: $this->string('name')->toString(),
            defaultCategoryId: $this->filled('default_category_id') ? $this->integer('default_category_id') : null,
            color: $this->filled('color') ? $this->string('color')->toString() : null,
        );
    }
}
