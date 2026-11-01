<?php

namespace App\Repositories;

use Carbon\CarbonImmutable;

/** The dedupe log of reminders already queued. */
interface SentReminderRepository
{
    /**
     * Records the reminder unless one for the same (subscription, payment date, days_before)
     * exists; true when this call recorded it.
     */
    public function record(int $subscriptionId, int $ruleId, CarbonImmutable $paymentDate, int $daysBefore): bool;
}
