<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReservationVerifyMail extends Mailable
{
    use Queueable, SerializesModels;

    public Reservation $reservation;
    public string $signedUrl;

    /**
     * Create a new message instance.
     */
    public function __construct(Reservation $reservation, string $signedUrl)
    {
        $this->reservation = $reservation;
        $this->signedUrl = $signedUrl;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('【予約確認】1時間以内に下記リンクをクリックしてください')
            ->view('emails.reservation_verify'); // Bladeテンプレートのパス
    }
}
