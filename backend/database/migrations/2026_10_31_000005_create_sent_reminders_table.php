<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sent_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reminder_rule_id')->constrained()->cascadeOnDelete();
            $table->date('payment_date');
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['subscription_id', 'reminder_rule_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sent_reminders');
    }
};
