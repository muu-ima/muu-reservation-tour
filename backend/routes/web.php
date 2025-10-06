<?php

use Illuminate\Support\Facades\Route;
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
| 他のテストルート・ページ
|--------------------------------------------------------------------------
*/

// デフォルトページ（開発時のみ残すならOK）
Route::get('/', function () {
    return view('welcome');
});

// もしHomeControllerを使っていないなら削除してOK
// Route::get('/home', [HomeController::class, 'index'])->name('home');
