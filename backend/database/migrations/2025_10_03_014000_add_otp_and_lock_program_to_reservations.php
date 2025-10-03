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
       // 1) 既存データを 'tour' に寄せる(NULL や別値を含め全て統一)
       DB::table('reservations')->where('program', '<>', 'tour')->update(['program' => 'tour']);
       DB::table('reservations')->whereNull('program')->update(['program' => 'tour']);

       // 2) デフォルトを 'tour' に
       DB::statement("ALTER TABLE reservations ALTER COLUMN program SET DEFAULT 'tour'");

       // 3) 既存の同種制約があれば落として作り直す (名前は任意)
        DB::statement("DO $$
        BEGIN
            IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'reservations_program_tour_only'
            ) THEN
             ALTER TABLE reservations DROP CONSTRAINT reservations_program_tour_only;
             END IF;
             END $$;");

             DB::statement("
             ALTER TABLE reservations
             ADD CONSTRAINT reservations_program_tour_only
             CHECK (program = 'tour')
             ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 逆方向:デフォルト解除&制約削除のみ (値の復元はしない)
        DB::statement("ALTER TABLE reservations ALTER COLUMN program DROP DEFAULT");
        DB::statement("ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_program_tour_only");
    }
};
