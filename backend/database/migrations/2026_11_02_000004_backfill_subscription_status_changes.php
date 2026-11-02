<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Every existing subscription (soft-deleted too) started active; a non-active one changed at its last update. */
    public function up(): void
    {
        DB::statement(<<<'SQL'
            INSERT INTO subscription_status_changes (subscription_id, status, changed_at, created_at)
            SELECT s.id, 'active', s.created_at, now()
            FROM subscriptions s
            WHERE NOT EXISTS (SELECT 1 FROM subscription_status_changes c WHERE c.subscription_id = s.id)
        SQL);

        DB::statement(<<<'SQL'
            INSERT INTO subscription_status_changes (subscription_id, status, changed_at, created_at)
            SELECT s.id, s.status, s.updated_at, now()
            FROM subscriptions s
            WHERE s.status <> 'active'
              AND (SELECT count(*) FROM subscription_status_changes c WHERE c.subscription_id = s.id) = 1
        SQL);
    }

    public function down(): void
    {
        DB::table('subscription_status_changes')->delete();
    }
};
