<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('availability_overrides', function (Blueprint $t) {
            $t->date('date')->primary();             // 例: 2025-10-15
            $t->boolean('open')->default(true);      // true=受付可, false=停止
            $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('availability_overrides');
    }
};
