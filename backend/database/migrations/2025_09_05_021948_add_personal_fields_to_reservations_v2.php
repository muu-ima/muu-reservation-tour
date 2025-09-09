<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // 追加カラム（既存データを壊さないように nullable に）
            $table->string('last_name')->nullable()->comment('姓');
            $table->string('first_name')->nullable()->comment('名');
            $table->string('email')->nullable()->comment('メールアドレス');
            $table->string('phone', 32)->nullable()->comment('電話番号');
            $table->string('notebook_type', 32)->nullable()->comment('区分/手帳等');
            $table->boolean('has_certificate')->default(false)->comment('資格/証明の有無');

            // 氏名での検索用：複合インデックス
            $table->index(['last_name', 'first_name']);
        });

        // 任意：既存の name から last_name へバックフィル（簡易）
        // ※ name が "山田太郎" などスペース無しのケースは last_name に全量コピー
        //   名前を厳密に分割したい場合は別途ロジックを用意
        if (Schema::hasColumn('reservations', 'name')) {
            DB::statement('
                UPDATE reservations
                SET last_name = COALESCE(last_name, name)
                WHERE name IS NOT NULL AND last_name IS NULL
            ');
        }
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // 複合インデックスを削除（自動命名：reservations_last_name_first_name_index）
            $table->dropIndex(['last_name', 'first_name']);

            // 追加したカラムをまとめて削除
            $table->dropColumn([
                'last_name',
                'first_name',
                'email',
                'phone',
                'notebook_type',
                'has_certificate',
            ]);
        });
    }
};
