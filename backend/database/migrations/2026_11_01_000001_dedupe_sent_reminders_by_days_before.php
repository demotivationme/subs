<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ruling R14: a reminder is deduped by (subscription, payment date, days_before) rather than
 * by rule id, so replacing, reverting or re-creating a rule with the same lead time does not
 * resend. The rule reference is kept for information and survives rule deletion as null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sent_reminders', function (Blueprint $table) {
            $table->unsignedSmallInteger('days_before')->nullable();
        });

        DB::statement('UPDATE sent_reminders SET days_before = reminder_rules.days_before
            FROM reminder_rules WHERE reminder_rules.id = sent_reminders.reminder_rule_id');

        // Rows that now collide on the new key were duplicate sends already; keep the oldest.
        DB::statement('DELETE FROM sent_reminders a USING sent_reminders b
            WHERE a.subscription_id = b.subscription_id AND a.payment_date = b.payment_date
            AND a.days_before = b.days_before AND a.id > b.id');

        Schema::table('sent_reminders', function (Blueprint $table) {
            $table->unsignedSmallInteger('days_before')->nullable(false)->change();
            $table->dropUnique(['subscription_id', 'reminder_rule_id', 'payment_date']);
            $table->unique(['subscription_id', 'payment_date', 'days_before']);

            $table->dropForeign(['reminder_rule_id']);
            $table->unsignedBigInteger('reminder_rule_id')->nullable()->change();
            $table->foreign('reminder_rule_id')->references('id')->on('reminder_rules')->nullOnDelete();
        });
    }

    public function down(): void
    {
        DB::table('sent_reminders')->whereNull('reminder_rule_id')->delete();

        Schema::table('sent_reminders', function (Blueprint $table) {
            $table->dropForeign(['reminder_rule_id']);
            $table->unsignedBigInteger('reminder_rule_id')->nullable(false)->change();
            $table->foreign('reminder_rule_id')->references('id')->on('reminder_rules')->cascadeOnDelete();

            $table->dropUnique(['subscription_id', 'payment_date', 'days_before']);
            $table->unique(['subscription_id', 'reminder_rule_id', 'payment_date']);
            $table->dropColumn('days_before');
        });
    }
};
