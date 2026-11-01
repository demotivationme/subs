<?php

namespace App\Http\Requests;

use App\Data\DeviceInput;
use App\Enums\Platform;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeviceRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[.+\]$/'],
            'platform' => ['required', Rule::enum(Platform::class)],
        ];
    }

    public function toInput(): DeviceInput
    {
        return new DeviceInput(
            token: $this->string('token')->toString(),
            platform: $this->enum('platform', Platform::class),
        );
    }
}
