<?php

namespace App\Http\Requests;

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

    /** Exists among global rows or rows owned by the current user. */
    protected function visible(string $table): Exists
    {
        $userId = $this->user()->id;

        return Rule::exists($table, 'id')->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId));
    }
}
