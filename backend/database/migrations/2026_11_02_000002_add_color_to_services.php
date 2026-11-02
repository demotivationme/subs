<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('color', 7)->nullable()->after('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('services', fn (Blueprint $table) => $table->dropColumn('color'));
    }
};
