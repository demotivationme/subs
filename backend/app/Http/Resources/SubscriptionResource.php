<?php

namespace App\Http\Resources;

use App\Models\Subscription;
use App\Services\SpendCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Subscription */
class SubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $monthly = app(SpendCalculator::class)->monthlyIn($this->resource, $request->user()->currency);

        return [
            'id' => $this->id,
            'service' => [
                'id' => $this->service->id,
                'name' => $this->service->name,
                'logo_url' => (new ServiceResource($this->service))->toArray($request)['logo_url'],
            ],
            'category' => [
                'id' => $this->category->id,
                'label' => $this->category->label(),
                'icon' => $this->category->icon,
                'color' => $this->category->color,
            ],
            'amount' => $this->amount,
            'currency' => $this->currency,
            'period' => $this->period->value,
            'interval_count' => $this->interval_count,
            'first_payment_date' => $this->first_payment_date->toDateString(),
            'next_payment_date' => $this->next_payment_date->toDateString(),
            'status' => $this->status->value,
            'notes' => $this->notes,
            'monthly_equivalent' => $monthly === null ? null : (int) round($monthly),
        ];
    }
}
