<?php

namespace App\Http\Requests;

use App\Data\SubscriptionInput;
use App\Enums\Period;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class StoreSubscriptionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'service_id' => ['required_without:service_name', 'nullable', 'integer', $this->visible('services')],
            'service_name' => ['required_without:service_id', 'nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer', $this->visible('categories')],
            'amount' => ['required', 'integer', 'min:0', 'max:100000000'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'period' => ['required', Rule::enum(Period::class)],
            'interval_count' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'first_payment_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function toInput(): SubscriptionInput
    {
        return new SubscriptionInput(
            serviceId: $this->filled('service_id') ? $this->integer('service_id') : null,
            serviceName: $this->filled('service_id') ? null : $this->string('service_name')->toString(),
            categoryId: $this->filled('category_id') ? $this->integer('category_id') : null,
            amount: $this->integer('amount'),
            currency: $this->string('currency')->toString(),
            period: $this->enum('period', Period::class),
            intervalCount: $this->integer('interval_count', 1),
            firstPaymentDate: $this->string('first_payment_date')->toString(),
            notes: $this->filled('notes') ? $this->string('notes')->toString() : null,
        );
    }

    /** Exists among global rows or rows owned by the current user. */
    protected function visible(string $table): Exists
    {
        $userId = $this->user()->id;

        return Rule::exists($table, 'id')->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId));
    }
}
