<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
-- アプリと同じロジックで、同一program内の時間重複を禁止（cancelledは除外）
CREATE OR REPLACE FUNCTION reservations_no_overlap_trg_fn() RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('booked','done') THEN
    IF EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.program = NEW.program
        AND r.status IN ('booked','done')
        AND r.id <> COALESCE(NEW.id, 0)
        -- 時間窓の交差：A.start < B.end AND A.end > B.start
        AND r.start_at < NEW.end_at
        AND r.end_at > NEW.start_at
    ) THEN
      RAISE EXCEPTION '同一プログラム内で時間帯が重複しています。'
      USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 冪等化：既存トリガーがあっても作り直す
DROP TRIGGER IF EXISTS reservations_no_overlap_trg ON reservations;
CREATE TRIGGER reservations_no_overlap_trg
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION reservations_no_overlap_trg_fn();
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TRIGGER IF EXISTS reservations_no_overlap_trg ON reservations;
DROP FUNCTION IF EXISTS reservations_no_overlap_trg_fn();
SQL);
    }
};