<?php

namespace App\Exceptions;

use Throwable;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;

use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Str;

class Handler extends ExceptionHandler
{
    /**
     * Laravel 10+ 形式
     */
    protected $levels = [
        // 例: \Illuminate\Auth\AuthenticationException::class => 'warning',
    ];

    /**
     * ログに出さない例外（必要があれば指定）
     */
    protected $dontReport = [
        // 例: \Illuminate\Auth\AuthenticationException::class,
    ];

    /**
     * バリデーション時にフラッシュしない入力
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function report(Throwable $e): void
    {
        parent::report($e);
    }

    public function render($request, Throwable $e)
    {
        // JSON が欲しいクライアント向けの整形（必要最低限）
        if ($request->expectsJson()) {

            // コントローラが返したレスポンスはそのまま通す
            if ($e instanceof HttpResponseException) {
                return $e->getResponse();
            }

            // バリデーションは標準的な形で返す
            if ($e instanceof ValidationException) {
                return response()->json([
                    'message' => '入力エラーです。',
                    'errors'  => $e->errors(),
                ], Response::HTTP_UNPROCESSABLE_ENTITY, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }

            // ここでは DB のユニーク違反は扱わない（register() の renderable で処理）
            if ($e instanceof HttpExceptionInterface) {
                return parent::render($request, $e);
            }

            return parent::render($request, $e);
        }

        return parent::render($request, $e);
    }

    public function register(): void
    {
        /**
         * DBユニーク違反だけを 409 にマップ（reservations テーブルに限定）
         * - Controller のメッセージを潰さないよう、ここで生成するのは
         *   「DBが弾いた時だけ」。
         */
        $this->renderable(function (UniqueConstraintViolationException $e, $request) {
            if (!$request->expectsJson()) return null;

            $msg = (string)$e->getMessage();
            if ($this->isReservationsUniqueViolation($msg)) {
            return response()->json([
                'message' => 'その時間帯は埋まっています',
                'source'  => 'handler:unique_violation',
            ], Response::HTTP_CONFLICT, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            return null;
        });

        // 旧来/他DBドライバ: QueryException からも捕捉（SQLSTATE=23505 等）
        $this->renderable(function (QueryException $e, $request) {
            if (!$request->expectsJson()) return null;

            $sqlState = $e->getCode() ?: ($e->errorInfo[0] ?? null);
            $msg = (string)$e->getMessage();

            $isUnique = ($sqlState === '23505') // PostgreSQL unique_violation
                || Str::contains($msg, ['UNIQUE constraint failed', 'duplicate key']);

            if ($isUnique && $this->isReservationsUniqueViolation($msg)) {
                return response()->json([
                    'message' => 'その時間帯は埋まっています',
                ], Response::HTTP_CONFLICT, [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            return null;
        });
    }

    /**
     * reservations テーブル由来のユニーク違反かどうかを判定
     * （他テーブルのユニークはここで横取りしない）
     */
    private function isReservationsUniqueViolation(string $message): bool
    {
        // 典型例:
        // - duplicate key value violates unique constraint "reservations_***"
        // - UNIQUE constraint failed: reservations.***
        return Str::contains($message, [
            'reservations_',      // PG のインデックス名
            'reservations.',      // SQLite のテーブル名付き
            'reservations ',      // 保険
            'on table "reservations"',
        ]);
    }
}