<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Carbon\Carbon;
// （任意）非同期にしたい場合は次行を有効化
// use Illuminate\Contracts\Queue\ShouldQueue;

class ReservationConfirmed extends Mailable // implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation) {}

    public function build()
    {
        $r = $this->reservation;

        // 表示用のスロット定義( 実運用の時間帯 )
        $slotMap = [
            'am' => ['label' => '午前', 'start' => '10:30', 'end' => '12:00'],
            'pm' => ['label' => '午後', 'start' => '13:30', 'end' => '15:00'],
        ];

        $slot = $r->slot;
        $slotLabel = $slotMap[$slot]['label'] ?? strtoupper((string)$slot);

        // DB に start_at / end_at があれば JST 変換して使う、 なければ slotMap の時間を使う
        $startTime = $r->start_at
        ? Carbon::parse($r->start_at)->timezone('Asia/Tokyo')->format('H:i')
        : ($slotMap[$slot]['start'] ?? null);

        $endTime = $r->end_at
        ? Carbon::parse($r->end_at)->timezone('Asia/Tokyo')->format('H:i')
        : ($slotMap[$slot]['end'] ?? null);

        $dateStr = Carbon::parse($r->date, 'Asia/Tokyo')->format('Y年n月j日 (D) ');

        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject('【予約確定】ご予約が確定しました')
            // Markdownメール。Bladeは resources/views/emails/reservations/confirmed.blade.php
            ->markdown('emails.reservations.confirmed', [
                'r' => $r,
                'dateStr'   => $dateStr,
                'slotLabel' => $slotLabel,
                'startTime' => $startTime,
                'endTime'   => $endTime,
            ]);
    }
}
