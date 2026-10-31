<?php

namespace App\Http\Resources;

use App\Models\ReminderRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ReminderRule */
class ReminderRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'days_before' => $this->days_before,
            'time_of_day' => $this->time_of_day,
            'channels' => $this->channels,
        ];
    }
}
