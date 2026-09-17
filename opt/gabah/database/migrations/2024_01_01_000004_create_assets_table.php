<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();

            // Authoritative & Immutable Asset Number
            // Format: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
            $table->string('asset_number', 50)->unique();

            // Corporate / ERP Asset Number (Accurate FST) - Manual, Nullable, Independent
            $table->string('corporate_asset_number', 50)->nullable()->index();

            // Ownership & Classification
            $table->foreignId('owner_division_id')->constrained('divisions')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('asset_category_id')->constrained('asset_categories')->cascadeOnUpdate()->restrictOnDelete();

            // Physical Placement & Custody (Does NOT alter asset_number or owner_division)
            $table->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('pic_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();

            // General Specifications
            $table->string('name', 150);
            $table->string('brand', 100)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('serial_number', 100)->nullable()->index();
            $table->string('hostname', 100)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->string('mac_address', 50)->nullable();

            // Status & Condition
            $table->string('status', 30)->default('available')->index(); // available, in_use, loaned, maintenance, disposed
            $table->string('condition', 30)->default('good')->index();  // good, fair, damaged

            // Financial & Warranty
            $table->decimal('price', 15, 2)->default(0);
            $table->date('purchase_date')->nullable();
            $table->date('warranty_until')->nullable()->index();

            // Extended Dynamic Attributes
            $table->jsonb('specs')->nullable();

            // Loan Rules
            $table->boolean('is_loanable')->default(false)->index();
            $table->boolean('loan_blocked')->default(false);
            $table->string('loan_blocked_reason', 255)->nullable();

            // System Metadata
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Composite Performance Index
            $table->index(['owner_division_id', 'status']);
        });

        // Historical tracking for custodian handover
        Schema::create('asset_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamp('returned_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'user_id']);
        });

        // Historical tracking for physical location movement
        Schema::create('asset_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('from_location_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->foreignId('to_location_id')->constrained('locations')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('moved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moved_at');
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['asset_id', 'to_location_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_movements');
        Schema::dropIfExists('asset_assignments');
        Schema::dropIfExists('assets');
    }
};
