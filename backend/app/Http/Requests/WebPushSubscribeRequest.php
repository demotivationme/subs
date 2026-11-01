<?php

namespace App\Http\Requests;

use App\Data\WebPushInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WebPushSubscribeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'endpoint' => ['required', 'url', 'max:500'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', Rule::in(['aesgcm', 'aes128gcm'])],
        ];
    }

    public function toInput(): WebPushInput
    {
        return new WebPushInput(
            endpoint: $this->string('endpoint')->toString(),
            publicKey: $this->string('keys.p256dh')->toString(),
            authToken: $this->string('keys.auth')->toString(),
            contentEncoding: $this->filled('content_encoding') ? $this->string('content_encoding')->toString() : 'aes128gcm',
        );
    }
}
