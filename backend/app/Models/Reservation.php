<?php

namespace App\Models; // ← app/Models 配下なら: namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Reservation extends Model
{
    use HasFactory;

    // 一括代入を許可するカラム
    protected $fillable = [
        'date','program','slot','room','name','contact','note','status','start_at','end_at',
        'last_name','first_name','email','phone','notebook_type','has_certificate',
    ];

    // 便利キャスト（任意）
    protected $casts = [
        'date'     => 'date:Y-m-d', 
        'start_at' => 'immutable_datetime',
        'end_at'   => 'immutable_datetime',
        'has_certificate' => 'boolean',
    ];
     protected static function booted()
    {
        static::saving(function (Reservation $r) {
            // ステータス等だけの更新なら、時刻をいじらない
            if (! $r->isDirty('date') && ! $r->isDirty('slot')) {
                return;
            }
            if (! $r->date || ! $r->slot) {
                return;
            }

            $slotStart = ['am' => '10:00:00', 'pm' => '14:00:00', 'full' => '10:00:00'];
            $slotEnd   = ['am' => '12:00:00', 'pm' => '16:00:00', 'full' => '16:00:00'];

            // casts 済みなので常に "Y-m-d" に正規化してから結合
            $dateStr = $r->date instanceof Carbon ? $r->date->toDateString() : (string)$r->date;
            $tz = 'Asia/Tokyo';

            if (isset($slotStart[$r->slot])) {
                $r->start_at = Carbon::createFromFormat('Y-m-d H:i:s', "$dateStr {$slotStart[$r->slot]}", $tz)->utc();
            }
            if (isset($slotEnd[$r->slot])) {
                $r->end_at   = Carbon::createFromFormat('Y-m-d H:i:s', "$dateStr {$slotEnd[$r->slot]}", $tz)->utc();
            }
        });
    }
}