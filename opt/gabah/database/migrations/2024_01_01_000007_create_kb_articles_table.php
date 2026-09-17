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
        Schema::create('kb_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->string('category', 50); // IT, General, License, SOP, Policy
            $table->longText('content');
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('views')->default(0);
            $table->string('status', 30)->default('published'); // draft, published, archived
            $table->timestamps();

            $table->index(['category', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kb_articles');
    }
};
