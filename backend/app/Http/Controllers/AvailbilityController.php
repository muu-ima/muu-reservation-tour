<?php

// app/Http/Controllers/AvailabilityController.php
namespace App\Http\Controllers;

use App\Models\AvailabilityOverride;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AvailabilityController extends Controller
{
    // 一覧: { "2025-10-15": true, "2025-10-16": false, ... }
    public function index()
    {
        return response()->json(
            AvailabilityOverride::query()->pluck('open','date')
        );
    }

    // 更新: PUT /api/availability/2025-10-16 { "open": false }
    public function update(string $date, Request $req)
    {
        Validator::validate(['date'=>$date], [
            'date' => ['required','date_format:Y-m-d'],
        ]);
        $data = Validator::validate($req->all(), [
            'open' => ['required','boolean'],
        ]);

        $row = AvailabilityOverride::updateOrCreate(
            ['date' => $date],
            ['open' => (bool)$data['open']]
        );

        return response()->json($row, 200);
    }
}
