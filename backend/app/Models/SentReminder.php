<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SentReminder extends Model
{
    public $timestamps = false;

    protected $fillable = ['subscription_id', 'reminder_rule_id', 'payment_date', 'days_before'];

    protected function casts(): array
    {
        return ['payment_date' => 'immutable_date'];
    }
}
