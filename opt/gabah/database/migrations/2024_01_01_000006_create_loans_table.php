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
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('loan_number', 50)->unique(); // LOAN-YY-XXXX
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->text('purpose');
            $table->dateTime('loan_date'); // start date & time
            $table->dateTime('due_date');  // expected return date & time
            $table->dateTime('returned_at')->nullable(); // actual returned time
            $table->string('status', 30)->default('pending'); // pending, approved, rejected, active, returned, overdue
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete(); // handover staff
            $table->text('notes')->nullable();
            $table->timestamps();

            // Critical index for Anti-Collision / Anti-Bentrok Query Performance
            $table->index(['asset_id', 'status', 'loan_date', 'due_date'], 'idx_loans_anti_collision');
            $table->index(['borrower_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
