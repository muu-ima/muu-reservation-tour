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
use Illuminate\Support\Facades\Log;

class ReservationController extends Controller
{
    private int $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /**
     * GET /api/reservations
     */
    public function index(Request $request)
    {
        // ひとまず全件返す（フロントで絞り込み）。必要になったらサーバー側フィルタを追加。
        $items = Reservation::query()
            ->orderBy('date')
            ->orderBy('start_at')
            ->get();

        return response()->json($items, 200, [], $this->jsonFlags);
    }

    /**
     * GET /api/reservations/{reservation}
     */
    public function show(Reservation $reservation)
    {
        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /**
     * POST /api/reservations
     */
    public function store(\Illuminate\Http\Request $request)
    {
        try {
            Log::info('req', $request->all()); // 受け取りログ

            // 既存のバリデーション＆保存ロジック
            // $validated = validator(...)->validate();
            // $r = Reservation::create($validated);
            // return response()->json($r, 201, $this->cors($request), $this->jsonFlags);
            // 0) 軽い正規化

            // --- 正規化（任意） ---
            if ($request->filled('phone')) {
                $request->merge(['phone' => mb_convert_kana($request->input('phone'), 'as')]);
            }
            foreach (['name', 'last_name', 'first_name', 'email', 'phone', 'contact', 'notebook_type', 'note'] as $k) {
                if ($request->filled($k) && is_string($request->$k)) {
                    $request->merge([$k => trim($request->$k)]);
                }
            }

            // --- バリデーション ---
            $data = $request->validate([
                'date'    => ['required', 'date_format:Y-m-d'],
                'slot'    => ['required', \Illuminate\Validation\Rule::in(['am', 'pm', 'full'])],
                'last_name' => ['nullable', 'string', 'max:191'],
                'first_name' => ['nullable', 'string', 'max:191'],
                'email'     => ['nullable', 'email', 'max:191'],
                'phone'     => ['nullable', 'string', 'max:32', 'regex:/^[0-9()+\s-]{8,}$/u'],
                'contact'   => ['nullable', 'string', 'max:191'],
                'notebook_type' => ['nullable', 'string', 'max:32'],
                'has_certificate' => ['nullable', 'boolean'],
                'note'      => ['nullable', 'string', 'max:2000'],
            ]);

            // サーバー側で強制固定
            $data['program'] = 'tour';
            $data['status'] = 'pending';

            $data['has_certificate'] = (bool)($data['has_certificate'] ?? false);
            $data['name'] = $this->buildFallbackName($data);

            [$startAt, $endAt] = $this->calcWindow($data['date'], $data['slot']);
            $data['start_at'] = $startAt;
            $data['end_at']   = $endAt;

            // --- 業務ルール ---
            if (($data['program'] ?? null) === 'tour' && ($data['slot'] ?? null) === 'full') {
                return response()->json(['message' => 'tour の full は許可されていません'], 422, $this->cors($request), $this->jsonFlags);
            }

            // --- デフォルト値 ---
            $data['status'] = $data['status'] ?? 'booked';
            $data['has_certificate'] = (bool)($data['has_certificate'] ?? false);
            $data['name'] = $this->buildFallbackName($data);

            // --- 時間枠計算（JST→UTC） ---
            [$startAt, $endAt] = $this->calcWindow($data['date'], $data['slot']);
            $data['start_at'] = $startAt;
            $data['end_at']   = $endAt;

            // --- 作成（重複チェックはDBトリガに任せる） ---
            $created = Reservation::create($data);

            return response()->json($created->toArray(), 201, $this->cors($request), $this->jsonFlags);
        } catch (QueryException $e) {
            if ($this->looksLikeOverlap($e)) {
                return $this->overlapResponse($request);
            }
            throw $e;
        } catch (\Throwable $e) {
            // ★ HttpResponseException はそのまま返す（409 JSON が完成済み）
            if ($e instanceof HttpResponseException) {
                return $e->getResponse();
            }

            // 既存：日本語/英語の重複メッセージ判定
            if ($this->looksLikeOverlap($e)) {
                return $this->overlapResponse($request);
            }

            // 置き換え（catch (\Throwable $e) 内のステータス決定ロジック）
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

    /**
     * 重複/オーバーラップ系の例外かどうかをざっくり判定（DB/アプリ層どちらも対応）
     */
    private function looksLikeOverlap(\Throwable $e): bool
    {
        $code = (string) ($e->getCode() ?? '');
        $msg = (string) $e->getMessage();
        $msgLower = mb_strtolower($msg);

        // DB 由来（SQLSTATE 等）
        $sqlState = '';
        if ($e instanceof QueryException) {
            $sqlState = (string) ($e->errorInfo[0] ?? '');
        }

        // 典型パターン
        if ($sqlState === '23505') {
            return true;
        }                 // unique_violation
        if ($sqlState === '23514') {
            return true;
        }                 // check_violation
        if (strtoupper($code) === 'P0001') {
            return true;
        }         // RAISE EXCEPTION（既定）

        // 制約名/トリガ名/英語文言
        if (Str::contains($msgLower, [
            'no_overlap',
            'reservations_no_overlap',
            'overlap',
            'duplicate key value violates unique constraint',
            'violates check constraint',
        ])) {
            return true;
        }

        // ★ 日本語文言（あなたの実メッセージを含む）
        if (Str::contains($msg, [
            '重複',
            '時間帯が重複',
            '同一プログラム',
            '予約が重複',
        ])) {
            return true;
        }

        return false;
    }

    /** 重複時の共通レスポンス（409） */
    private function overlapResponse(Request $request)
    {
        return response()->json(
            [
                'message' => 'duplicate/overlap',
                'errors' => [
                    'date_slot' => ['この枠は既に埋まっています。別の日時/枠を選んでください。'],
                ],
            ],
            409,
            $this->cors($request),
            $this->jsonFlags
        );
    }

    /**
     * 例外時含め必ず CORS を付けるためのヘッダ生成
     */
    private function cors(\Illuminate\Http\Request $request): array
    {
        $origin = $request->headers->get('Origin');
        $ok = $origin && (
            preg_match('#^https://.*\.vercel\.app$#', $origin) ||
            in_array($origin, ['https://muu-reservation.vercel.app', 'http://localhost:3000', 'https://localhost:3000'], true)
        );

        return $ok ? [
            'Access-Control-Allow-Origin' => $origin,
            'Vary' => 'Origin',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With',
        ] : [];
    }

    /**
     * PATCH /api/reservations/{reservation}
     */
    public function update(Request $request, Reservation $reservation)
    {
        $data = $request->validate([
            'date' => ['sometimes', 'date'],
            'slot' => ['sometimes', Rule::in(['am', 'pm'])],
            'status' => ['sometimes', Rule::in(['booked', 'done', 'cancelled'])],

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

        // マージ後の値を確定
        $merged = array_merge($reservation->toArray(), $data);

        // 常に tour を強制
        $merged['program'] = 'tour';

        // tour は full を禁止
        if (($merged['program'] ?? 'tour') === 'tour' && ($merged['slot'] ?? 'am') === 'full') {
            return response()->json(['message' => 'tour は full を選べません'], Response::HTTP_UNPROCESSABLE_ENTITY, [], $this->jsonFlags);
        }

        // has_certificate の安全化
        if (array_key_exists('has_certificate', $data)) {
            $merged['has_certificate'] = (bool) $data['has_certificate'];
        }

        // name フォールバック（明示的に name が空にされた場合も拾う）
        if (! array_key_exists('name', $data) || $data['name'] === null || $data['name'] === '') {
            $merged['name'] = $this->buildFallbackName($merged);
        }

        // date/slot 更新時は start/end 再計算（未指定なら現状維持）
        $date = $merged['date'] ?? $reservation->date?->toDateString();
        $slot = $merged['slot'] ?? $reservation->slot;
        [$startAt, $endAt] = $this->calcWindow($date, $slot);
        $merged['start_at'] = $startAt;
        $merged['end_at'] = $endAt;

        // ★ 同一 program 限定の重複判定（自分は除外）
        $this->assertNoProgramOverlap($merged, $reservation->id);

        $reservation->fill($merged)->save();

        // 最新のモデルを返却
        $reservation->refresh();

        return response()->json($reservation, 200, [], $this->jsonFlags);
    }

    /**
     * DELETE /api/reservations/{reservation}
     */
    public function destroy(Reservation $reservation)
    {
        $reservation->delete();

        return response()->noContent(); // 204
    }

    /**
     * JST "YYYY-MM-DD" + slot → UTC start/end を返す
     * am: 10:00-12:00, pm: 13:00-15:00, full: 10:00-15:00 （必要に応じて調整）
     *
     * @return array{0: \Illuminate\Support\Carbon, 1: \Illuminate\Support\Carbon}
     */
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
        // DB カラムが timestamp(UTC) 前提。アプリ側の casts もあわせておくこと。
    }

    /**
     * 同日・同slotで既に "booked" がある場合は 409 を返す（program は tour 固定）
     *
     * @param array $data             予約データ（date, slot 必須）
     * @param int|null $excludeId     更新時に自分自身を除外したい場合のID（新規作成は null）
     */
    protected function assertNoProgramOverlap(array $data, ?int $excludeId = null): void
    {
        $date = $data['date'] ?? null;
        $slot = $data['slot'] ?? null;

        if (! $date || ! $slot) {
            // 必須が欠けている場合はここでは判定しない（前段のバリデで弾く想定）
            return;
        }

        $q = \App\Models\Reservation::query()
            ->whereDate('date', $date)
            ->where('program', 'tour')  // tour 固定
            ->where('status', 'booked') // 確定した予約のみ重複判定
            ->where('slot', $slot);      // am/pm 同一枠を禁止

        if ($excludeId !== null) {
            $q->where('id', '<>', $excludeId); // 自分は除外（更新時）
        }

        if ($q->exists()) {
            abort(response()->json([
                'message' => 'duplicate/overlap',
                'errors'  => [
                    'date_slot' => ['この枠は既に埋まっています。別の日時/スロットを選んでください。'],
                ],
            ], 409));
        }
    }

    /**
     * name が空の場合、姓+名 -> ゲスト の順でフォールバック
     */
    private function buildFallbackName(array $in): string
    {
        $name = trim((string) ($in['name'] ?? ''));
        if ($name !== '') {
            return $name;
        }

        $ln = trim((string) ($in['last_name'] ?? ''));
        $fn = trim((string) ($in['first_name'] ?? ''));
        if ($ln !== '' || $fn !== '') {
            return $ln . $fn; // 和名連結（半角スペースを入れたい場合は "{$ln} {$fn}" に）
        }

        return 'ゲスト';
    }
}
