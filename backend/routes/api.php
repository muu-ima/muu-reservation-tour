<?php

use App\Http\Controllers\ReservationController;
use App\Http\Controllers\AvailabilityController;
use App\Http\Middleware\DevCors;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

    // 🔹 日別 受付可否API（管理UIから呼ぶ用）
    Route::get('/availability', [AvailabilityController::class, 'index']);
    Route::put('/availability/{date}', [AvailabilityController::class, 'update']);

    // 🔹 予約キャンセル（枠を自動で解放）
    Route::patch('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel'])
        ->name('reservations.cancel');

    // ヘルスチェック
    Route::get('/healthz', function () {
        return response()->json([
            'ok' => true,
            'ts' => now()->toIso8601String(),
            'app' => config('app.name'),
        ], 200);
    });
});
