<?php

namespace App\Http\Requests;

use App\Enums\Channel;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReminderRulesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'rules' => ['present', 'array', 'max:'.config('subs.max_reminder_rules')],
            'rules.*.days_before' => ['required', 'integer', 'min:0', 'max:60', 'distinct'],
            'rules.*.time_of_day' => ['required', 'date_format:H:i'],
            'rules.*.channels' => [
                'required', 'array', 'min:1',
                // `distinct` on the wildcard child would compare across rules, so check per rule.
                fn (string $attribute, mixed $value, Closure $fail) => is_array($value) && count($value) !== count(array_unique($value))
                    ? $fail('validation.distinct')->translate()
                    : null,
            ],
            'rules.*.channels.*' => ['required', Rule::enum(Channel::class)],
        ];
    }
}
