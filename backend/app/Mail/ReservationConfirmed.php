<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
// （任意）非同期にしたい場合は次行を有効化
// use Illuminate\Contracts\Queue\ShouldQueue;

class ReservationConfirmed extends Mailable // implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation) {}

    public function build()
    {
        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject('【予約確定】ご予約が確定しました')
            // Markdownメール。Bladeは resources/views/emails/reservations/confirmed.blade.php
            ->markdown('emails.reservations.confirmed', [
                'r' => $this->reservation,
            ]);
    }
}
