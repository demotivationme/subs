<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    public $timestamps = false;

    protected $fillable = ['date', 'base', 'quote', 'rate'];

    protected function casts(): array
    {
        return ['date' => 'immutable_date', 'rate' => 'float'];
    }
}
