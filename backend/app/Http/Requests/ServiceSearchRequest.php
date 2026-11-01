<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ServiceSearchRequest extends FormRequest
{
    public function rules(): array
    {
        return ['q' => ['nullable', 'string', 'max:100']];
    }

    public function searchQuery(): ?string
    {
        return $this->filled('q') ? $this->string('q')->toString() : null;
    }
}
