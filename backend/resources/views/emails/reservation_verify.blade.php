<p>{{ $reservation->last_name }} {{ $reservation->first_name }} 様</p>

<p>仮予約ありがとうございます。<br>
1時間以内に以下のリンクをクリックすると予約が確定します。</p>

<p>  <a href="{{ $signedUrl }}"
     style="display:inline-block;padding:10px 16px;border-radius:6px;
            background:#0d6efd;color:#fff;text-decoration:none;">
    予約を確定する
  </a>
</p>

<p style="font-size:12px;color:#666;">
  有効期限：{{ $reservation->verify_expires_at?->timezone('Asia/Tokyo')->format('Y-m-d H:i') }}<br>
  ※期限を過ぎると自動的にキャンセルされます。
</p>