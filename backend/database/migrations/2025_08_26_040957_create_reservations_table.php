<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->date('date');                           // 予約日
            $table->string('program');                      // 'tour' | 'experience'
            $table->string('slot');                         // 'am'  | 'pm' | 'full'
            $table->string('name');                         // 予約者
            $table->string('contact')->nullable();
            $table->text('note')->nullable();
            $table->string('status')->default('booked');    // booked/cancelled
            $table->timestamp('start_at')->nullable();      // 実際の開始/終了
            $table->timestamp('end_at')->nullable();
            $table->timestamps();

            $table->index(['date', 'program', 'slot']);
        });

        // 時間帯の重複をDB側で禁止(同一roomでの重なりを排他)
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
        DB::statement("
        ALTER TABLE reservations
        ADD CONSTRAINT reservations_no_overlap
        EXCLUDE USING GIST (
            room WITH =,
            tsrange(start_at, end_at, '[]') WITH &&
            )
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_overlap');
        Schema::dropIfExists('reservations');
    }
};
