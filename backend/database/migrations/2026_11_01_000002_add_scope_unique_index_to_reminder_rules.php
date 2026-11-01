<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** days_before is unique within a scope (the user's defaults, or one subscription's overrides). */
return new class extends Migration
{
    public function up(): void
    {
        // Rows that already collide come from racing PUTs; keep the newest of each.
        DB::statement('DELETE FROM reminder_rules a USING reminder_rules b
            WHERE a.user_id = b.user_id AND a.days_before = b.days_before
            AND COALESCE(a.subscription_id, 0) = COALESCE(b.subscription_id, 0) AND a.id < b.id');

        DB::statement('CREATE UNIQUE INDEX reminder_rules_scope_days_before_unique
            ON reminder_rules (user_id, COALESCE(subscription_id, 0), days_before)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS reminder_rules_scope_days_before_unique');
    }
};
