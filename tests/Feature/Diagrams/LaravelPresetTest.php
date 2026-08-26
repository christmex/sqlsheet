<?php

use App\Actions\Diagrams\GenerateDiagramMigrations;
use App\Enums\ColumnKind;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Get the Laravel preset.
 *
 * @return array<string, mixed>
 */
function laravelPreset(): array
{
    return collect(config('table_presets'))->firstWhere('key', 'laravel-13');
}

/**
 * Build a diagram document out of a preset's tables.
 *
 * @param  array<int, array{name: string, columns: array<int, array<string, mixed>>}>  $tables
 * @return array<string, mixed>
 */
function documentFromPresetTables(array $tables): array
{
    $nodes = [];

    foreach ($tables as $tableIndex => $table) {
        $nodes[] = [
            'id' => 'tbl_'.$tableIndex,
            'type' => 'table',
            'position' => ['x' => 0, 'y' => 0],
            'data' => [
                'name' => $table['name'],
                'headerColor' => '#6366f1',
                'columns' => collect($table['columns'])
                    ->map(fn (array $column, int $columnIndex) => $column + ['id' => "col_{$tableIndex}_{$columnIndex}"])
                    ->all(),
            ],
        ];
    }

    return ['version' => 1, 'nodes' => $nodes, 'edges' => [], 'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1]];
}

test('the preset lists exactly the tables this Laravel skeleton creates', function () {
    $tablesInSkeleton = collect(File::glob(database_path('migrations/0001_01_01_*.php')))
        ->flatMap(function (string $path) {
            preg_match_all("/Schema::create\('([a-z_]+)'/", File::get($path), $matches);

            return $matches[1];
        })
        ->sort()
        ->values()
        ->all();

    $tablesInPreset = collect(laravelPreset()['tables'])->pluck('name')->sort()->values()->all();

    expect($tablesInPreset)->toBe($tablesInSkeleton);
});

test('every preset column names a type the exporter understands', function () {
    $kinds = collect(laravelPreset()['tables'])
        ->flatMap(fn (array $table) => collect($table['columns'])->pluck('type.kind'))
        ->unique()
        ->values();

    expect($kinds)->each->toBeIn(ColumnKind::values());
});

test('the preset produces migrations that actually build the schema', function () {
    $directory = storage_path('framework/testing/preset-migrations-'.Str::random(8));

    File::ensureDirectoryExists($directory);

    /**
     * The preset creates the very tables the test database already has, so it is
     * run under a prefix. What is being proved is that the generated migrations
     * are accepted and build the right columns, not what they are called.
     */
    $tables = collect(laravelPreset()['tables'])
        ->map(fn (array $table) => ['name' => 'preset_'.$table['name']] + $table)
        ->all();

    $migrations = (new GenerateDiagramMigrations)->handle(
        documentFromPresetTables($tables),
        CarbonImmutable::parse('2026-03-01 09:00:00'),
    );

    foreach ($migrations as $filename => $contents) {
        File::put($directory.'/'.$filename, $contents);
    }

    try {
        $this->artisan('migrate', ['--path' => $directory, '--realpath' => true])->assertSuccessful();
    } finally {
        File::deleteDirectory($directory);
    }

    expect(Schema::hasColumns('preset_users', ['id', 'name', 'email', 'email_verified_at', 'password', 'remember_token', 'created_at', 'updated_at']))->toBeTrue()
        ->and(Schema::hasColumns('preset_sessions', ['id', 'user_id', 'ip_address', 'user_agent', 'payload', 'last_activity']))->toBeTrue()
        ->and(Schema::hasColumns('preset_job_batches', ['id', 'name', 'total_jobs', 'pending_jobs', 'failed_jobs', 'failed_job_ids', 'options', 'cancelled_at', 'created_at', 'finished_at']))->toBeTrue();
});
