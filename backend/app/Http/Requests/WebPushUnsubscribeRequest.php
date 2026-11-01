<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WebPushUnsubscribeRequest extends FormRequest
{
    public function rules(): array
    {
        return ['endpoint' => ['required', 'url']];
    }

    public function endpoint(): string
    {
        return $this->string('endpoint')->toString();
    }
}
