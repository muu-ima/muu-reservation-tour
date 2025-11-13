<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class Reservation extends Model
{
    use HasFactory;

    /** 一括代入を許可する属性 */
    protected $fillable = [
        'date', 'program', 'slot',
        'name', 'last_name', 'first_name', 'kana',
        'email', 'phone', 'contact',
        'notebook_type', 'has_certificate',
        'note', 'status',
        'start_at', 'end_at',
        'verified_at', 'verify_token', 'verify_expires_at',
        'cancelled_at',
          // ▼ WordPress 副本用
        'wp_post_id',
        'wp_sync_status',
        'wp_synced_at',
    ];

    /** キャスト設定 */
    protected $casts = [
        'date'              => 'date:Y-m-d',
        'start_at'          => 'datetime',
        'end_at'            => 'datetime',
        'verified_at'       => 'datetime',
        'verify_expires_at' => 'datetime',
        'cancelled_at'      => 'datetime',
        'has_certificate'   => 'boolean',
                // ▼ WP同期日時
        'wp_synced_at'      => 'datetime',
    ];

    /** ステータス定義 */
    public const STATUS_PENDING   = 'pending';
    public const STATUS_BOOKED    = 'booked';
    public const STATUS_DONE      = 'done';
    public const STATUS_CANCELED = 'canceled';

    /** スロット定義（am/pm のみ） */
    public const SLOT_AM = 'am';
    public const SLOT_PM = 'pm';

    /** 有効枠（予約占有状態）判定 */
    public function getIsActiveAttribute(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_BOOKED], true);
    }

    /** 日付・スロット変更時に start_at / end_at を JST→UTC に再計算 */
    protected static function booted(): void
    {
        static::saving(function (Reservation $r) {
            if (! $r->isDirty('date') && ! $r->isDirty('slot')) return;
            if (! $r->date || ! $r->slot) return;

            // am / pm だけの時間帯設定
            $slotStart = [
                self::SLOT_AM => '10:00:00',
                self::SLOT_PM => '13:00:00',
            ];
            $slotEnd = [
                self::SLOT_AM => '12:00:00',
                self::SLOT_PM => '15:00:00',
            ];

            $dateStr = $r->date instanceof Carbon ? $r->date->toDateString() : (string)$r->date;
            $tz = 'Asia/Tokyo';

            if (isset($slotStart[$r->slot])) {
                $r->start_at = Carbon::createFromFormat('Y-m-d H:i:s', "$dateStr {$slotStart[$r->slot]}", $tz)->utc();
            }
            if (isset($slotEnd[$r->slot])) {
                $r->end_at = Carbon::createFromFormat('Y-m-d H:i:s', "$dateStr {$slotEnd[$r->slot]}", $tz)->utc();
            }
        });
    }
}
