<?php

namespace App\Http\Requests;

use App\Data\SubscriptionFilter;
use App\Enums\SubscriptionStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubscriptionIndexRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(SubscriptionStatus::class)],
            'category_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['price', 'next_payment', 'name'])],
        ];
    }

    public function toInput(): SubscriptionFilter
    {
        return new SubscriptionFilter(
            status: $this->enum('status', SubscriptionStatus::class),
            categoryId: $this->filled('category_id') ? $this->integer('category_id') : null,
            sort: $this->filled('sort') ? $this->string('sort')->toString() : 'next_payment',
        );
    }
}
