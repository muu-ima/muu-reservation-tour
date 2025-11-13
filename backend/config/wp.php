<?php

return [

    /*
    |--------------------------------------------------------------------------
    | WordPress Sync Settings
    |--------------------------------------------------------------------------
    |
    | Laravel 正本 → WordPress 副本 へデータをコピーするための
    | 接続情報・エンドポイント設定。
    |
    */

    // 例: https://example.com
    'base_url' => env('WP_BASE_URL'),

    // Application Password のユーザ名（WPのメールアドレス）
    'user'     => env('WP_USER'),

    // Application Password（スペース込みの文字列）
    'password' => env('WP_APP_PASSWORD'),

    // 予約 CPT のエンドポイント
    // 例: /wp-json/wp/v2/reservation
    'endpoint' => env('WP_RESERVATION_ENDPOINT', '/wp-json/wp/v2/reservation'),
];
