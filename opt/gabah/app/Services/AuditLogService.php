<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Request;

class AuditLogService
{
    public function log(
        ?int $userId,
        string $action,
        string $auditableType,
        int $auditableId,
        ?array $oldValues = null,
        ?array $newValues = null
    ): AuditLog {
        return AuditLog::create([
            'user_id' => $userId,
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => Request::ip() ?? '127.0.0.1',
            'user_agent' => substr(Request::userAgent() ?? 'System', 0, 255),
            'created_at' => now(),
        ]);
    }
}
