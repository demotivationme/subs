<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** A free account already has the maximum number of subscriptions (answers 403). */
final class SubscriptionLimitReached extends AccessDeniedHttpException
{
    public function __construct(int $limit)
    {
        parent::__construct(__('subscriptions.limit_reached', ['limit' => $limit]));
    }
}
