<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceCors
{
    public function handle(Request $request, Closure $next)
    {
        $res = $next($request);

        $origin = $request->headers->get('Origin');
        $ok = $origin && (
            preg_match('#^https://.*\.vercel\.app$#', $origin) ||
            in_array($origin, [
                'https://muu-reservation.vercel.app',
                'http://localhost:3000',
                'https://localhost:3000',
            ], true)
        );

        if ($ok) {
            $res->headers->set('Access-Control-Allow-Origin', $origin);
            $res->headers->set('Vary', 'Origin');
            $res->headers->set('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS');
            $res->headers->set('Access-Control-Allow-Headers','Content-Type, Authorization, X-Requested-With');
        }
        return $res;
    }
}
