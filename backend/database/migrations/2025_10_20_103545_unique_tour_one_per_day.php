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
        // 旧インデックス（tourに限れば不要）をまず落とす
        DB::statement("DROP INDEX IF EXISTS uniq_reservations_active");

        // tour で pending/booked の行に限り、(program, date) を 1 日 1 件に制限
        DB::statement("
            CREATE UNIQUE INDEX IF NOT EXISTS unique_tour_one_per_day
            ON reservations (program, date)
            WHERE program = 'tour' AND status IN ('pending','booked')
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("DROP INDEX IF EXISTS unique_tour_one_per_day");

        DB::statement("
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_reservations_active
        ON reservations (date, slot)
        WHERE status IN ('pending','booked') AND program ='tour'
        ");
    }
};
