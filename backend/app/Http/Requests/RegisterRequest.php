<?php

namespace App\Http\Requests;

use App\Data\RegisterInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $locale = $this->input('locale');

        $email = $this->input('email');

        $this->merge([
            'email' => is_string($email) ? Str::lower($email) : $email,
            'locale' => is_string($locale) && in_array($locale, config('subs.locales'), true) ? $locale : config('app.locale'),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'timezone' => ['required', 'timezone:all'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'locale' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ];
    }

    public function toInput(): RegisterInput
    {
        return new RegisterInput(
            name: $this->string('name')->toString(),
            email: $this->string('email')->toString(),
            password: $this->string('password')->toString(),
            timezone: $this->string('timezone')->toString(),
            currency: $this->string('currency')->toString(),
            locale: $this->string('locale')->toString(),
            deviceName: $this->string('device_name')->toString(),
        );
    }
}
