<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\ReservationVerifyMail;

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
        try {
            Log::info('req', $request->all());

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
                $reservation->verify_expires_at,
                ['reservation' => $reservation->id, 'token' => $reservation->verify_token]
            );

            // メール送信
            Mail::to($reservation->email)->send(new ReservationVerifyMail($reservation, $signedUrl));

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
            }

            $status = 500;
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
            }
            $payload = ['message' => 'サーバーエラーが発生しました。'];
            if (config('app.debug')) {
                $payload['exception'] = get_class($e);
                $payload['detail'] = (string) $e->getMessage();
                Log::error('store error', [
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
            'status' => ['sometimes', Rule::in(['pending', 'booked', 'done', 'cancelled'])],
            'name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'first_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'email' => ['sometimes', 'nullable', 'email', 'max:191'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'contact' => ['sometimes', 'nullable', 'string', 'max:191'],
            'notebook_type' => ['sometimes', 'nullable', 'string', 'max:32'],
            'has_certificate' => ['sometimes', 'nullable', 'boolean'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);

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
            'am' => ['10:00:00', '12:00:00'],
            'pm' => ['13:00:00', '15:00:00'],
            'full' => ['10:00:00', '15:00:00'],
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
        if (! $request->hasValidSignature()) {
            return response()->view('verify.error', [
                'title' => '認証エラー',
                'message' => 'リンクの有効期限が切れているか、URLが改ざんされています。',
            ], 400);
        }

        $token = $request->query('token');
        if (! $token || $token !== $reservation->verify_token) {
            return response()->view('verify.error', [
                'title' => '認証エラー',
                'message' => '無効なリンクです。もう一度予約をやり直してください。',
            ], 400);
        }

        if ($reservation->status !== 'pending') {
            return response()->view('verify.error', [
                'title' => 'すでに処理済み',
                'message' => 'この予約はすでに確定またはキャンセルされています。',
            ], 409);
        }

        if ($reservation->verify_expires_at && now()->greaterThan($reservation->verify_expires_at)) {
            $reservation->status = 'cancelled';
            $reservation->save();

            return response()->view('verify.error', [
                'title' => '期限切れ',
                'message' => '確認リンクの有効期限が切れたため、予約はキャンセルされました。',
            ], 410);
        }

        $this->assertNoProgramOverlap([
            'date'    => $reservation->date->toDateString(),
            'slot'    => $reservation->slot,
            'program' => 'tour',
        ], $reservation->id);

        $reservation->status = 'booked';
        $reservation->verified_at = now();
        $reservation->verify_token = null;
        $reservation->verify_expires_at = null;
        $reservation->save();

        return response()->view('verify.success', [
            'title' => '予約確定',
            'message' => '予約が確定しました。ありがとうございます！',
            'reservation' => $reservation,
        ], 200);
    }
}
