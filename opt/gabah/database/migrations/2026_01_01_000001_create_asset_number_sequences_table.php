<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_number_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_division_id')->constrained('divisions')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('asset_code', 20); // e.g. HLT, HPC, INV-F, MSN
            $table->integer('year');          // e.g. 2026
            $table->integer('last_number')->default(0);
            $table->timestamps();

            // Strict Concurrency & Reset per year scope
            $table->unique(['owner_division_id', 'asset_code', 'year'], 'uniq_div_code_year_seq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_number_sequences');
    }
};
