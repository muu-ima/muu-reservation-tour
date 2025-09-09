<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // ★ 完全一致（末尾 / なし）
    'allowed_origins' => [
        'https://muu-reservation.vercel.app',
        'http://localhost:3000',
        'https://localhost:3000',
    ],

    // ★ プレビュー( *.vercel.app )を許可したいならこちら
    'allowed_origins_patterns' => [
        '#^https://.*\.vercel\.app$#',
    ],

    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,

    // Cookieベース認証を使っていなければ false のままでOK
    'supports_credentials' => false,
];
