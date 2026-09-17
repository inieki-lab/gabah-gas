<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes & Scheduled Cron Jobs (Laravel 11)
|--------------------------------------------------------------------------
|
| Modern Laravel 11 task scheduling defined directly via routes/console.php.
| Running on Proxmox cron: * * * * * cd /opt/gabah && php artisan schedule:run >> /dev/null 2>&1
|
*/

// 1. Check for overdue loans daily at 00:01 WIB and flag delinquent borrowers
Schedule::command('loans:check-overdue')
    ->dailyAt('00:01')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_loans_overdue.log'));

// 2. Helpdesk SLA Monitoring: check every 10 minutes, auto-escalate priority on breach
Schedule::command('tickets:check-sla --escalate')
    ->everyTenMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_tickets_sla.log'));

// 3. Weekly Asset Lifecycle & Warranty/License Expirations check every Monday at 08:00 WIB
Schedule::command('assets:check-expirations --days=45')
    ->weeklyOn(1, '08:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/cron_assets_expirations.log'));
