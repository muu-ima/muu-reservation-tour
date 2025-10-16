@component('mail::message')
# ご予約が確定しました

{{ $r->last_name }} {{ $r->first_name }} 様

以下の内容でご予約が確定しました。

- 日付：{{ $r->date }}
- 時間帯：{{ $r->slot }}
- プログラム：{{ $r->program }}

ご来場をお待ちしております。

@endcomponent
