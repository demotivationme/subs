<?php

namespace App\Repositories;

use Closure;
use Illuminate\Support\Facades\DB;

final class DatabaseTransactionRunner implements TransactionRunner
{
    public function run(Closure $callback): mixed
    {
        return DB::transaction($callback);
    }
}
