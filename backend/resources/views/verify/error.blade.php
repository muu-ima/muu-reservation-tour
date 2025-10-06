<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>{{ $title ?? 'エラー' }}</title>
    <style>
        body { font-family: sans-serif; margin: 3em; line-height: 1.8; }
        .err { color: red; }
    </style>
</head>
<body>
    <h1 class="err">{{ $title ?? 'エラー' }}</h1>
    <p>{{ $message ?? '無効なアクセスです。' }}</p>
    <p><a href="/">トップに戻る</a></p>
</body>
</html>
