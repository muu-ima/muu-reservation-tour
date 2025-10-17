<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Mail;
use App\Http\Controllers\ReservationController;
use Illuminate\Support\Facades\URL;
use App\Mail\ReservationConfirmed;
use App\Models\Reservation;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| メール内の検証リンク（署名付きURL）を処理するルート
|
*/

// 🟢 署名付きURLを受け取って検証
Route::get('/verify/{reservation}', [ReservationController::class, 'verify'])
    ->name('reservations.verify')
    ->middleware('signed'); // ← 署名チェック（期限もURL内に埋め込める）


/*
|--------------------------------------------------------------------------
| Mailpit で Bladeメールをプレビュー表示 (開発専用)
|--------------------------------------------------------------------------
*/
Route::get('/preview-mail', function () {
    $reservation = (object)[
        'first_name' => '太郎',
        'last_name'  => '山田',
        'verify_expires_at' => now()->addHour(),
    ];
    $signedUrl = 'https://example.com/verify/abc123';

    // ✅ ここタイポ修正済み（'seignedUrl' → 'signedUrl'）
    return view('emails.reservation_verify', compact('reservation', 'signedUrl'));
});

/*
|--------------------------------------------------------------------------
| Mailpit 経由で Markdownメール（予約確定通知）をテスト送信
|--------------------------------------------------------------------------
*/
Route::get('/mail-confirm-test', function () {
    // 保存はしないダミー予約を用意（個別代入ならmass assignmentに引っかからない）
    $r = new Reservation();
    $r->first_name = '太郎';
    $r->last_name  = '山田';
    $r->program    = '見学';
    $r->slot       = 'am';            // 'am' or 'pm'（Mailable内の$slotMapに合わせる）
    $r->date       = '2025-10-20';    // Carbon::parseできる形式に

    // start_at / end_at を省略すれば、Mailable内の $slotMap の時刻が使われる
    // 必要なら↓のように指定もOK
    // $r->start_at = '2025-10-20 10:30:00';
    // $r->end_at   = '2025-10-20 12:00:00';

    Mail::to('test@example.com')->send(new ReservationConfirmed($r));

    return '✅ Mailpit に「ご予約確定メール（Markdown）」を送信しました。';
});

/*
|--------------------------------------------------------------------------
| Mailpit経由でBladeメール送信テスト (署名付きURL付き)
|--------------------------------------------------------------------------
*/
Route::get('/verify-test/{id}', function ($id) {
    return "✅ Signed URL OK. id={$id}";
})->name('reservations.verify.test')->middleware('signed');

Route::get('/mail-verify-test', function () {
    $reservation = (object)[
        'id' => 123,
        'first_name' => '太郎',
        'last_name'  => '山田',
        'verify_expires_at' => now()->addHour(),
    ];

    // 1時間有効の署名付きURLを生成（ダミー用）
    $signedUrl = URL::temporarySignedRoute(
        'reservations.verify.test',
        now()->addHour(),
        ['id' => $reservation->id]
    );

    // Mailpit に送信
    Mail::send('emails.reservation_verify', [
        'reservation' => $reservation,
        'signedUrl'   => $signedUrl,
    ], function ($m) {
        $m->to('test@example.com')
          ->subject('予約確認メールテスト（署名付きURL）');
    });

    return '✅ Mailpit に「署名付きURLテスト」メールを送信しました。';
});

/*
|--------------------------------------------------------------------------
| 他のテストルート・ページ
|--------------------------------------------------------------------------
*/
Route::get('/mail-test', function () {
    try {
        Mail::raw('Mailpit 経由のテスト送信です。', function ($m) {
            $m->to('enyukari.k.imamura@gmail.com')
              ->subject('Mailpit テストメール');
        });
        return '✅ メール送信を実行しました。MailpitまたはGmailを確認してください。';
    } catch (\Throwable $e) {
        return '❌ 送信エラー: ' . $e->getMessage();
    }
});

Route::get('/', function () {
    return view('welcome');
});