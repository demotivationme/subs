<?php

namespace App\Http\Resources;

use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Service */
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'color' => $this->color,
            'default_category_id' => $this->default_category_id,
            'is_custom' => $this->user_id !== null,
        ];
    }
}
