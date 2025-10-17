{{-- resources/views/emails/layout.blade.php --}}
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "Helvetica", "Arial", sans-serif; color: #333; }
    .btn {
      display: inline-block;
      background: #007bff;
      color: #fff;
      padding: 10px 16px;
      text-decoration: none;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  @yield('content')
</body>
</html>
