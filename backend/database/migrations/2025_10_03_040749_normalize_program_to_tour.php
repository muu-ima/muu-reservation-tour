<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('reservations')
            ->where('program', '<>', 'tour')
            ->orWhereNull('program')
            ->update(['program' => 'tour']);
    }

    public function down(): void
    {
        // no-op（元に戻さない）
    }
};
