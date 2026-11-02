<?php

namespace App\Http\Requests;

use App\Data\SubscriptionChanges;
use App\Enums\Period;
use App\Enums\SubscriptionStatus;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class UpdateSubscriptionRequest extends StoreSubscriptionRequest
{
    public function rules(): array
    {
        return [
            'service_id' => ['sometimes', 'integer', $this->visible('services')],
            'service_name' => ['sometimes', 'string', 'max:100'],
            'category_id' => ['sometimes', 'integer', $this->visible('categories')],
            'amount' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'period' => ['sometimes', Rule::enum(Period::class)],
            'interval_count' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'first_payment_date' => ['sometimes', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::enum(SubscriptionStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'reminders_enabled' => ['sometimes', 'boolean'],
        ];
    }

    public function toChanges(): SubscriptionChanges
    {
        $data = $this->validated();

        return new SubscriptionChanges(
            attributes: Arr::except($data, ['service_id', 'service_name']),
            serviceId: isset($data['service_id']) ? (int) $data['service_id'] : null,
            serviceName: isset($data['service_id']) ? null : ($data['service_name'] ?? null),
        );
    }
}
