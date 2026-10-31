<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained();
            $table->foreignId('category_id')->constrained();
            $table->bigInteger('amount');
            $table->char('currency', 3);
            $table->string('period', 10);
            $table->unsignedSmallInteger('interval_count')->default(1);
            $table->date('first_payment_date');
            $table->date('next_payment_date');
            $table->string('status', 10)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
