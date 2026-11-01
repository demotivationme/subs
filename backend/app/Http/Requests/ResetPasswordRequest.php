<?php

namespace App\Http\Requests;

use App\Data\PasswordResetInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', Password::defaults()],
        ];
    }

    public function toInput(): PasswordResetInput
    {
        return new PasswordResetInput(
            email: $this->string('email')->toString(),
            password: $this->string('password')->toString(),
            token: $this->string('token')->toString(),
        );
    }
}
