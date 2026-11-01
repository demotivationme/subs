<?php

namespace App\Http\Requests;

use App\Data\ProfileChanges;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'timezone:all'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'locale' => ['sometimes', Rule::in(config('subs.locales'))],
        ];
    }

    public function toInput(): ProfileChanges
    {
        $data = $this->validated();

        return new ProfileChanges(
            name: $data['name'] ?? null,
            timezone: $data['timezone'] ?? null,
            currency: $data['currency'] ?? null,
            locale: $data['locale'] ?? null,
        );
    }
}
