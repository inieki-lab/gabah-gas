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
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_division_id')->nullable()->constrained('divisions')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('category_type', 20); // IT, General, License (mapped via App\Enums\CategoryType)
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['owner_division_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('asset_categories');
    }
};
