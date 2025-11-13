<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\ReservationVerifyMail;
use App\Mail\ReservationConfirmed;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Jobs\SyncReservationToWordPress;

class ReservationController extends Controller
{
    private int $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /* ===============================
     * GET /api/reservations
     * =============================== */
    public function index(Request $request)
    {
        $items = Reservation::query()
            ->orderBy('date')
            ->orderBy('start_at')
            ->get();

        return response()->json($items, 200, [], $this->jsonFlags);
    }

    /* ===============================
     * GET /api/reservations/{reservation}
     * =============================== */
    public function show(Reservation $reservation)
    {
        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /* ===============================
     * POST /api/reservations
     * =============================== */
    public function store(Request $request)
    {
        Log::info('🟢 store() started', ['input' => $request->all()]);

        try {
            Log::info('✅ store() entered', $request->all());

            // ▼ reCAPTCHA v3 検証をここで実施
            $token  = $request->input('recaptchaToken');
            $secret = env('RECAPTCHA_SECRET_KEY');

            if (!$token || !$secret) {
                Log::warning('reCAPTCHA token or secret missing', [
                    'token'  => $token,
                    'secret_exists' => (bool) $secret,
                ]);

                return response()->json(
                    ['message' => 'reCAPTCHA 検証に失敗しました。時間をおいて再度お試しください。'],
                    400,
                    $this->cors($request),
                    $this->jsonFlags
                );
            }

            try {
                $res = Http::asForm()->post(
                    'https://www.google.com/recaptcha/api/siteverify',
                    [
                        'secret'   => $secret,
                        'response' => $token,
                    ]
                );

                $body  = $res->json();
                $score = $body['score'] ?? null;

                // success=false または スコアが低すぎる場合は拒否
                if (!($body['success'] ?? false) || $score < 0.5) {
                    Log::warning('reCAPTCHA failed', [
                        'result' => $body,
                    ]);

                    return response()->json(
                        [
                            'message' => 'reCAPTCHA 判定に失敗しました。',
                            'score'   => $score,
                        ],
                        400,
                        $this->cors($request),
                        $this->jsonFlags
                    );
                }
            } catch (\Throwable $e) {
                Log::error('reCAPTCHA http error', [
                    'error' => $e->getMessage(),
                ]);

                return response()->json(
                    ['message' => 'reCAPTCHA サーバーとの通信に失敗しました。'],
                    500,
                    $this->cors($request),
                    $this->jsonFlags
                );
            }

            // 軽い正規化
            if ($request->filled('phone')) {
                $request->merge(['phone' => mb_convert_kana($request->input('phone'), 'as')]);
            }
            foreach (['name', 'last_name', 'first_name', 'email', 'phone', 'contact', 'notebook_type', 'note'] as $k) {
                if ($request->filled($k) && is_string($request->$k)) {
                    $request->merge([$k => trim($request->$k)]);
                }
            }

            // バリデーション
            $data = $request->validate([
                'date'    => ['required', 'date_format:Y-m-d'],
                'slot'    => ['required', Rule::in(['am', 'pm', 'full'])],
                'last_name' => ['nullable', 'string', 'max:191'],
                'first_name' => ['nullable', 'string', 'max:191'],
                'kana' => ['nullable', 'regex:/^[ぁ-んー　\s]+$/u'],
                'email'     => ['nullable', 'email', 'max:191'],
                'phone'     => ['nullable', 'string', 'max:32', 'regex:/^[0-9()+\s-]{8,}$/u'],
                'contact'   => ['nullable', 'string', 'max:191'],
                'notebook_type' => ['nullable', 'string', 'max:32'],
                'has_certificate' => ['nullable', 'boolean'],
                'note'      => ['nullable', 'string', 'max:2000'],
            ]);

            $data['program'] = 'tour';
            $data['status'] = 'pending';
            $data['has_certificate'] = (bool)($data['has_certificate'] ?? false);
            $data['name'] = $this->buildFallbackName($data);

            [$startAt, $endAt] = $this->calcWindow($data['date'], $data['slot']);
            $data['start_at'] = $startAt;
            $data['end_at']   = $endAt;

            if ($data['program'] === 'tour' && $data['slot'] === 'full') {
                return response()->json(['message' => 'tour の full は許可されていません'], 422, $this->cors($request), $this->jsonFlags);
            }

            // 予約作成
            $reservation = Reservation::create($data);

            // 検証情報
            $reservation->verify_token = Str::uuid()->toString();
            $reservation->verify_expires_at = now()->addHour();
            $reservation->save();

            // 署名付きURL（1時間有効）
            $signedUrl = URL::temporarySignedRoute(
                'reservations.verify',
                now()->addHour(),
                ['reservation' => $reservation->id, 'token' => $reservation->verify_token]
            );

            // メール送信（失敗しても500を返さないように変更）
            try {
                Mail::to($reservation->email)->send(new ReservationVerifyMail($reservation, $signedUrl));
            } catch (\Throwable $mailEx) {
                Log::warning('✉️ Mail send failed', [
                    'to' => $reservation->email,
                    'error' => $mailEx->getMessage(),
                ]);
                // 送信失敗でも予約自体は作成成功なので 201 を返す
                // ✅ ここで副本WPへ同期Jobをキューに投げる
            }
            SyncReservationToWordPress::dispatch($reservation->id)->afterCommit();
            return response()->json($reservation, 201);
        } catch (QueryException $e) {
            if ($this->looksLikeOverlap($e)) {
                return $this->overlapResponse($request);
            }
            throw $e;
        } catch (\Throwable $e) {
            if ($e instanceof HttpResponseException) {
                return $e->getResponse();
            }

            if ($this->looksLikeOverlap($e)) {
                return $this->overlapResponse($request);
                // ← ここを無条件ログに変更（本番でも必ず出る）
                Log::error('❌ store() failed', [
                    'exception' => get_class($e),
                    'message'   => $e->getMessage(),
                    'file'      => $e->getFile(),
                    'line'      => $e->getLine(),
                    'trace'     => collect($e->getTrace())->take(3),
                ]);
            }

            $status = 500;
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
            }
            $payload = ['message' => 'サーバーエラーが発生しました。'];
            if (config('app.debug')) {
                $payload['exception'] = get_class($e);
                $payload['detail'] = (string) $e->getMessage();
                Log::error('❌ store() failed',  [
                    'msg' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => collect($e->getTrace())->take(3),
                ]);
            }
            return response()->json($payload, $status, $this->cors($request), $this->jsonFlags);
        }
    }

    /* ===============================
     * PATCH /api/reservations/{reservation}
     * =============================== */
    public function update(Request $request, Reservation $reservation)
    {
        $data = $request->validate([
            'date' => ['sometimes', 'date'],
            'slot' => ['sometimes', Rule::in(['am', 'pm'])],
            'status' => ['sometimes', Rule::in(['pending', 'booked', 'done', 'canceled', 'cancelled'])],
            'name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'kana' => ['sometimes', 'nullable', 'regex:/^[ぁ-んー　\s]+$/u'],
            'email' => ['sometimes', 'nullable', 'email', 'max:191'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'contact' => ['sometimes', 'nullable', 'string', 'max:191'],
            'notebook_type' => ['sometimes', 'nullable', 'string', 'max:32'],
            'has_certificate' => ['sometimes', 'nullable', 'boolean'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

        if (array_key_exists('status', $data)) {
            $data['status'] = $data['status'] === 'cancelled' ? 'canceled' : $data['status'];
        }

        $merged = array_merge($reservation->toArray(), $data);
        $merged['program'] = 'tour';

        if ($merged['program'] === 'tour' && ($merged['slot'] ?? 'am') === 'full') {
            return response()->json(['message' => 'tour は full を選べません'], Response::HTTP_UNPROCESSABLE_ENTITY, [], $this->jsonFlags);
        }

        if (array_key_exists('has_certificate', $data)) {
            $merged['has_certificate'] = (bool)$data['has_certificate'];
        }

        if (!array_key_exists('name', $data) || $data['name'] === null || $data['name'] === '') {
            $merged['name'] = $this->buildFallbackName($merged);
        }

        $date = $merged['date'] ?? $reservation->date?->toDateString();
        $slot = $merged['slot'] ?? $reservation->slot;
        [$startAt, $endAt] = $this->calcWindow($date, $slot);
        $merged['start_at'] = $startAt;
        $merged['end_at'] = $endAt;

        $reservation->fill($merged)->save();
        $reservation->refresh();

        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /**
     * PATCH /api/reservations/{reservation}/cancel
     * 履歴を残しつつ、部分ユニークから外して枠を即時解放する
     */
    public function cancel(Reservation $reservation)
    {
        return DB::transaction(function () use ($reservation) {
            /** @var Reservation $r */
            $r = Reservation::whereKey($reservation->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            // すでに終了系なら冪等にOK返す（両綴り + done を許容）
            if (in_array($r->status, ['canceled', 'cancelled', 'done'], true)) {
                return response()->json([
                    'message'     => 'Reservation already finished or canceled.',
                    'reservation' => $r,
                ], 200);
            }

            // キャンセル可能な状態だけ許可
            if (!in_array($r->status, ['pending', 'booked'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This reservation cannot be canceled from current status.'],
                ]);
            }

            // ステータスは米式 "canceled" に統一
            $r->status = 'canceled';

            // タイムスタンプ列は両対応（存在する方に書く）
            $tsCol = in_array('cancelled_at', $r->getFillable(), true) ? 'cancelled_at'
                : (in_array('canceled_at',  $r->getFillable(), true) ? 'canceled_at' : null);
            if ($tsCol) {
                $r->{$tsCol} = now();
            }

            // もし検証用のトークン類を持っていれば掃除（任意）
            if (in_array('verify_token', $r->getFillable(), true)) {
                $r->verify_token = null;
            }
            if (in_array('verify_expires_at', $r->getFillable(), true)) {
                $r->verify_expires_at = null;
            }

            $r->save();

            return response()->json([
                'message'     => 'Reservation canceled and slot reopened.',
                'reservation' => $r->refresh(),
            ], 200);
        });
    }

    public function destroy(Reservation $reservation)
    {
        $reservation->delete();
        return response()->noContent();
    }

    /* ===============================
     * JST日時→UTC変換
     * =============================== */
    private function calcWindow(string $dateYmd, string $slot): array
    {
        $ranges = [
            'am' => ['10:30:00', '12:00:00'],
            'pm' => ['13:30:00', '15:00:00'],
        ];
        [$startHHMMSS, $endHHMMSS] = $ranges[$slot] ?? $ranges['am'];

        $startJst = Carbon::parse("{$dateYmd} {$startHHMMSS}", 'Asia/Tokyo');
        $endJst = Carbon::parse("{$dateYmd} {$endHHMMSS}", 'Asia/Tokyo');

        return [$startJst->clone()->utc(), $endJst->clone()->utc()];
    }

    private function buildFallbackName(array $in): string
    {
        $name = trim((string)($in['name'] ?? ''));
        if ($name !== '') return $name;

        $ln = trim((string)($in['last_name'] ?? ''));
        $fn = trim((string)($in['first_name'] ?? ''));
        if ($ln !== '' || $fn !== '') return $ln . $fn;

        return 'ゲスト';
    }

    /* ===============================
     * GET /verify/{reservation}?token=xxxxx
     * =============================== */

    public function verify(Request $request, Reservation $reservation)
    {
        // ミニHTMLを返す小さなヘルパ
        $html = function (string $title, string $message) {
            return response(
                '<!doctype html><meta charset="utf-8">' .
                    '<meta name="robots" content="noindex,nofollow">' .
                    '<title>' . e($title) . '</title>' .
                    '<style>body{font-family:sans-serif;line-height:1.8;margin:3rem;color:#111}</style>' .
                    '<h1 style="font-size:1.25rem;margin:0 0 .5rem 0;">' . e($title) . '</h1>' .
                    '<p>' . nl2br(e($message)) . '</p>',
                200
            )->header('Content-Type', 'text/html; charset=UTF-8');
        };

        // 署名チェック（URL改ざん/期限切れ）
        if (! $request->hasValidSignature()) {
            return $html('リンクが無効です', "リンクの有効期限が切れているか、URLが改ざんされています。");
        }

        // トークン一致確認（トークン方式を使っている場合）
        $token = $request->query('token');
        if (! $token || $token !== $reservation->verify_token) {
            return $html('リンクが無効です', "無効なリンクです。お手数ですが、最初から予約をやり直してください。");
        }

        // 期限切れは自動キャンセルにして終了
        if ($reservation->verify_expires_at && now()->greaterThan($reservation->verify_expires_at)) {
            $reservation->update(['status' => 'canceled']);
            return $html('有効期限切れ', "確認リンクの有効期限が切れたため、予約はキャンセルされました。");
        }

        // 多重クリック・再訪問（pending 以外は何もしない）
        if ($reservation->status !== 'pending') {
            return $html('処理済み', "この予約はすでに確定またはキャンセルされています。");
        }

        // 確定処理
        $reservation->forceFill([
            'status'            => 'booked',
            'verified_at'       => now(),
            'verify_token'      => null,
            'verify_expires_at' => null,
        ])->save();

        // 確定メール（Markdown）送信：失敗しても確定は維持
        try {
            Mail::to($reservation->email)->send(new ReservationConfirmed($reservation));
        } catch (\Throwable $e) {
            Log::error('✉️ ReservationConfirmed send failed', [
                'rid' => $reservation->id,
                'to'  => $reservation->email,
                'e'   => $e->getMessage(),
            ]);
        }

        // 最小HTMLで完了表示（危険サイト警告を避けつつユーザーに分かる）
        return $html('予約が確定しました', "ありがとうございます。数分以内に「確定メール」をお送りしますのでご確認ください。");
    }

    // 予約の重複（ユニーク制約違反）っぽいか判定
    private function looksLikeOverlap(\Throwable $e): bool
    {
        if ($e instanceof \Illuminate\Database\QueryException) {
            // PostgreSQLの一意制約違反 SQLSTATE は 23505
            $code1 = $e->getCode();
            $code2 = $e->errorInfo[0] ?? null;
            if ($code1 === '23505' || $code2 === '23505') return true;

            $msg = (($e->errorInfo[2] ?? '') . ' ' . $e->getMessage());
            if (is_string($msg) && (
                str_contains($msg, 'duplicate key value violates unique constraint') ||
                str_contains($msg, 'uniq_reservations_active') ||
                str_contains($msg, 'reservations_date_slot')
            )) return true;
        }
        return false;
    }

    // 409 Conflict を返す共通レスポンス（CORS/JSONフラグ維持）
    private function overlapResponse(Request $request)
    {
        return response()->json([
            'message' => 'その日時は仮予約/確定済みです。別の枠を選んでください。',
            'error'   => 'duplicate_reservation',
        ], \Symfony\Component\HttpFoundation\Response::HTTP_CONFLICT, $this->cors($request), $this->jsonFlags);
    }

    // CORS ヘッダを返す簡易ヘルパ（必要に応じて調整）
    private function cors(Request $request): array
    {
        $origin = $request->headers->get('Origin');
        if (!$origin) {
            return []; // Originが無い場合はヘッダ付けない
        }
        return [
            'Access-Control-Allow-Origin'      => $origin,   // or '*' でも可
            'Vary'                             => 'Origin',
            'Access-Control-Allow-Credentials' => 'true',
        ];
    }
}
