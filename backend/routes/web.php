<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Mail;
use App\Http\Controllers\ReservationController;

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
| 開発・テスト用ルート
|--------------------------------------------------------------------------
|
| Render → Gmail へメール送信テストするためのルート。
| 動作確認後は削除してOK。
|
*/

Route::get('/mail-test', function () {
    try {
        Mail::raw('Render から Gmail 経由で送信テスト成功！', function ($m) {
            $m->to('enyukari.k.imamura@gmail.com') // ← ここを自分のGmailに置き換えてください
              ->subject('Laravel SMTP テストメール');
        });
        return '✅ メール送信を実行しました。Gmailを確認してください。';
    } catch (\Throwable $e) {
        return '❌ 送信エラー: ' . $e->getMessage();
    }
});

/*
|--------------------------------------------------------------------------
| 他のテストルート・ページ
|--------------------------------------------------------------------------
*/

// デフォルトページ（開発時のみ残すならOK）
Route::get('/', function () {
    return view('welcome');
});

// もしHomeControllerを使っていないなら削除してOK
// Route::get('/home', [HomeController::class, 'index'])->name('home');
