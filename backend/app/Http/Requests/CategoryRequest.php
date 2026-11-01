<?php

namespace App\Http\Requests;

use App\Data\CategoryInput;
use Illuminate\Foundation\Http\FormRequest;

class CategoryRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:50'],
            'icon' => ['sometimes', 'string', 'max:50'],
            'color' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    public function toInput(): CategoryInput
    {
        return new CategoryInput(...$this->validated());
    }
}
