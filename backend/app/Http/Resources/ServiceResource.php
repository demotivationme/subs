<?php

namespace App\Http\Resources;

use App\Models\Service;
use App\Services\ServiceLogoStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Service */
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'logo_url' => app(ServiceLogoStorage::class)->url($this->logo_path),
            'color' => $this->color,
            'default_category_id' => $this->default_category_id,
            'is_custom' => $this->user_id !== null,
        ];
    }
}
