<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 50)->unique(); // TKT-YY-XXXX
            $table->string('type', 50)->default('incident'); // incident, request, maintenance
            $table->string('subject', 200);
            $table->text('description');
            $table->string('status', 30)->default('open'); // open, in_progress, pending_vendor, resolved, closed
            $table->string('priority', 20)->default('medium'); // low, medium, high, urgent
            $table->timestamp('sla_response_deadline')->nullable();
            $table->timestamp('sla_resolution_deadline')->nullable();
            $table->boolean('is_over_sla')->default(false);
            $table->foreignId('asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category', 50); // IT, General, License, Facility
            $table->string('approval_status', 30)->default('pending'); // pending, approved, rejected, not_required
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'priority']);
            $table->index(['sla_resolution_deadline', 'is_over_sla']);
            $table->index(['requester_id']);
            $table->index(['assignee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
