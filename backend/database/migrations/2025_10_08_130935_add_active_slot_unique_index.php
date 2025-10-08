<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // status が pending / booked かつ program='tour' のレコードに対して
        // (date, slot) をユニークにする（= 枠ロック）
        DB::statement("
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservations_active
            ON reservations (date, slot)
            WHERE status IN ('pending','booked') AND program = 'tour'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("DROP INDEX IF EXISTS uniq_reservations_active");
    }
};
