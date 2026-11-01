<?php

namespace App\Repositories;

use Closure;

/** Runs several repository calls atomically. */
interface TransactionRunner
{
    /**
     * Commits when $callback returns, rolls back and rethrows when it throws.
     *
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function run(Closure $callback): mixed;
}
