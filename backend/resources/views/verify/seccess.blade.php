<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>{{ $title ?? '予約確認' }}</title>
    <style>
        body { font-family: sans-serif; margin: 3em; line-height: 1.8; }
        .ok { color: green; }
    </style>
</head>
<body>
    <h1 class="ok">{{ $title ?? '予約確定' }}</h1>
    <p>{{ $message ?? '' }}</p>

    <p>日付：{{ $reservation->date }} / 枠：{{ strtoupper($reservation->slot) }}</p>
    <p>お名前：{{ $reservation->last_name }} {{ $reservation->first_name }}</p>

    <p>この画面を閉じても予約は有効です。</p>
</body>
</html>
