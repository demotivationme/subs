<?php

namespace App\Http\Requests;

use App\Data\StatsQuery;
use Illuminate\Foundation\Http\FormRequest;

class StatsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'year' => ['nullable', 'integer', 'min:2000', 'max:'.($this->user()->today()->year + 1)],
            'month' => ['nullable', 'integer', 'between:1,12'],
        ];
    }

    public function toQuery(): StatsQuery
    {
        return new StatsQuery(
            year: $this->filled('year') ? $this->integer('year') : $this->user()->today()->year,
            month: $this->filled('month') ? $this->integer('month') : null,
        );
    }
}
