<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        //
    ];

    /**
     * Define the application's command schedule.
     *
     * @return void
     */
    protected function schedule(\Illuminate\Console\Scheduling\Schedule $schedule): void
    {
        // 期限切れPENDINGの自動キャンセル（直近10分ぶんを対象にする設計は維持）
        $schedule->command('reservations:cancel-expired-pending --minutes=10')
            ->hourly()
            ->withoutOverlapping()
            ->onOneServer()
            ->sendOutputTo(storage_path('logs/schedule_cancel_expired.log'));

        // BOOKED→DONE の更新
        $schedule->command('reservations:mark-booked-done')
        ->hourly()
        ->withoutOverlapping()
        ->onOneServer()
        ->sendOutputTo(storage_path('logs/schedule_mark_done.log'));
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__ . '/Commands');

        require base_path('routes/console.php');
    }
}
