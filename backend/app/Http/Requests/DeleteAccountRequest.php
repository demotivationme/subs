<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Account deletion is confirmed with the current password. */
class DeleteAccountRequest extends FormRequest
{
    public function rules(): array
    {
        return ['password' => ['required', 'current_password:sanctum']];
    }
}
