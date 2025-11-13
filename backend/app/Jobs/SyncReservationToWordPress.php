<?php

namespace App\Jobs;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class SyncReservationToWordPress implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public array $backoff = [10, 30, 60, 120, 300];

    public int $reservationId;

    /**
     * Job を作った時に、同期したい予約IDを受け取る。
     */
    public function __construct(int $reservationId)
    {
        $this->reservationId = $reservationId;
    }

    /**
     * WP 副本へ同期する処理
     */
    public function handle(): void
    {
        $reservation = Reservation::find($this->reservationId);

        if (!$reservation) {
            return;
        }

        // --- WP接続情報 ---
        $base = rtrim(config('wp.base_url'), '/');
        $endpoint = ltrim(config('wp.endpoint'), '/');
        $url = "{$base}/{$endpoint}";

        // --- Payload作成 ---
        $payload = [
            'title'  => sprintf(
                '%s %s %s',
                $reservation->date?->format('Y-m-d'),
                strtoupper($reservation->slot),
                $reservation->last_name
            ),
            'status' => 'publish',
            'meta'   => [
                'reservation_date'            => $reservation->date?->format('Y-m-d'),
                'reservation_program'         => $reservation->program,
                'reservation_slot'            => $reservation->slot,
                'reservation_last_name'       => $reservation->last_name,
                'reservation_first_name'      => $reservation->first_name,
                'reservation_kana'            => $reservation->kana,
                'reservation_email'           => $reservation->email,
                'reservation_phone'           => $reservation->phone,
                'reservation_notebook_type'   => $reservation->notebook_type,
                'reservation_has_certificate' => (bool)$reservation->has_certificate,
                'reservation_note'            => $reservation->note,
                'payload_json'                => json_encode($reservation->toArray(), JSON_UNESCAPED_UNICODE),
            ],
        ];

        // --- WordPress へ POST ---
        $response = Http::withBasicAuth(
            config('wp.user'),
            config('wp.password')
        )
            ->acceptJson()
            ->post($url, $payload);

        // --- 失敗処理 ---
        if ($response->failed()) {
            $reservation->update([
                'wp_sync_status' => 'failed',
            ]);

            // ログ残す
            logger()->error('WP Sync Failed', [
                'reservation_id' => $reservation->id,
                'body'           => $response->body()
            ]);

            // リトライへ
            $this->fail();
            return;
        }

        // --- 成功処理 ---
        $json = $response->json();

        $reservation->update([
            'wp_post_id'     => $json['id'] ?? null,
            'wp_sync_status' => 'synced',
            'wp_synced_at'   => now('UTC'),
        ]);
    }
}
