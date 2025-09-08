<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\DevCors;
use App\Http\Controllers\ReservationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| すべてのAPIを DevCors 経由にまとめ、ReservationController に一本化
*/

Route::middleware([DevCors::class])->group(function () {

    // （必要なら）認証付きユーザー情報
    Route::middleware('auth:api')->get('/user', function (Request $request) {
        return $request->user();
    });

    // 予約API（index/show/store/update/destroy）
    Route::apiResource('reservations', ReservationController::class)
        ->only(['index', 'show', 'store', 'update', 'destroy']);

    // ヘルスチェック
    Route::get('/healthz', function () {
        return response()->json([
            'ok'  => true,
            'ts'  => now()->toIso8601String(),
            'app' => config('app.name'),
        ], 200);
    });
});
