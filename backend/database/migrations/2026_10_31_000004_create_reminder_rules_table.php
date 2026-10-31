<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reminder_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('days_before');
            $table->time('time_of_day');
            $table->jsonb('channels');
            $table->timestamps();
            $table->index(['user_id', 'subscription_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminder_rules');
    }
};
