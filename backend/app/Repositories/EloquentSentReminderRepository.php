<?php

namespace App\Repositories;

use App\Models\SentReminder;
use Carbon\CarbonImmutable;

final class EloquentSentReminderRepository implements SentReminderRepository
{
    public function record(int $subscriptionId, int $ruleId, CarbonImmutable $paymentDate, int $daysBefore): bool
    {
        return SentReminder::query()->insertOrIgnore([
            'subscription_id' => $subscriptionId,
            'reminder_rule_id' => $ruleId,
            'payment_date' => $paymentDate->toDateString(),
            'days_before' => $daysBefore,
        ]) === 1;
    }
}
