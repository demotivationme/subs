<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_status_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->string('status', 10);
            $table->timestampTz('changed_at');
            $table->timestampTz('created_at')->nullable();
            $table->index(['subscription_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_status_changes');
    }
};
