<p>{{ $reservation->last_name }} {{ $reservation->first_name }} 様</p>

<p>仮予約ありがとうございます。<br>
1時間以内に以下のリンクをクリックすると予約が確定します。</p>

<p><a href="{{ $signedUrl }}">{{ $signedUrl }}</a></p>

<p>有効期限：{{ $reservation->verify_expires_at?->timezone('Asia/Tokyo')->format('Y-m-d H:i') }}</p>

<p>※期限を過ぎると自動的にキャンセルされます。</p>
