<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class ServiceLogoRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048',
                'dimensions:min_width=64,min_height=64,max_width=2048,max_height=2048'],
        ];
    }

    public function logo(): UploadedFile
    {
        return $this->file('logo');
    }
}
