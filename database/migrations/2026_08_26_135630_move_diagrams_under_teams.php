<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Diagrams now belong straight to a team.
 *
 * The project layer forced a two-step before anything could be drawn while buying
 * only grouping, which is not needed until a team holds many diagrams. Grouping can
 * come back later as an optional folder on the diagram itself.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('diagrams', function (Blueprint $table) {
            $table->foreignId('team_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        DB::table('diagrams')->orderBy('id')->each(function (object $diagram) {
            $teamId = DB::table('projects')->where('id', $diagram->project_id)->value('team_id');

            DB::table('diagrams')->where('id', $diagram->id)->update(['team_id' => $teamId]);
        });

        DB::table('diagrams')->whereNull('team_id')->delete();

        Schema::table('diagrams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('project_id');
        });

        Schema::table('diagrams', function (Blueprint $table) {
            $table->foreignId('team_id')->nullable(false)->change();
        });

        Schema::dropIfExists('projects');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->timestamps();

            $table->unique(['team_id', 'slug']);
        });

        Schema::table('diagrams', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        Schema::table('diagrams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_id');
        });
    }
};
