<?php

use Illuminate\Support\Facades\File;

/**
 * Read the columns one skeleton migration declares, table by table.
 *
 * The preset claims to reproduce these migrations. Comparing table names alone
 * would not have caught a column typed `integer` where the skeleton says
 * `bigInteger`, which is exactly the mistake this test exists to catch.
 *
 * @return array<string, array<int, array<string, mixed>>>
 */
function columnsDeclaredIn(string $migrationPath): array
{
    $source = File::get($migrationPath);
    $tables = [];

    preg_match_all(
        "/Schema::create\('([a-z_]+)', function \(Blueprint \\\$table\) \{(.*?)\n        \}\);/s",
        $source,
        $blocks,
        PREG_SET_ORDER,
    );

    foreach ($blocks as [, $tableName, $body]) {
        $columns = [];

        foreach (explode("\n", $body) as $line) {
            if (! preg_match("/\\\$table->([a-zA-Z]+)\((.*?)\)((?:->[a-zA-Z]+\([^)]*\))*);/", trim($line), $call)) {
                continue;
            }

            [, $method, $arguments, $modifiers] = $call;

            // Helpers that stand for several columns are written out in the preset.
            if ($method === 'timestamps') {
                foreach (['created_at', 'updated_at'] as $timestampColumn) {
                    $expanded = ['name' => $timestampColumn, 'kind' => 'timestamp', 'isNullable' => true, 'keys' => []];
                    ksort($expanded);
                    $columns[] = $expanded;
                }

                continue;
            }

            if ($method === 'rememberToken') {
                $rememberToken = ['name' => 'remember_token', 'kind' => 'string', 'length' => 100, 'isNullable' => true, 'keys' => []];
                ksort($rememberToken);
                $columns[] = $rememberToken;

                continue;
            }

            // A standalone index declaration is not a column, and indexes are a
            // declared loss of the preset either way.
            if (in_array($method, ['index', 'unique', 'primary'], true)) {
                continue;
            }

            preg_match("/'([a-z_]+)'(?:,\s*(\d+))?/", $arguments, $argumentParts);

            $keys = [];

            if (str_contains($modifiers, '->primary(')) {
                $keys[] = 'primary';
            }

            if (str_contains($modifiers, '->unique(')) {
                $keys[] = 'unique';
            }

            $column = [
                'name' => $argumentParts[1] ?? $method,
                'kind' => $method === 'id' ? 'id' : $method,
                'isNullable' => str_contains($modifiers, '->nullable('),
                'keys' => $keys,
            ];

            if ($method === 'id') {
                $column['keys'] = ['primary'];
            }

            if (in_array($method, ['string', 'char'], true)) {
                $column['length'] = isset($argumentParts[2]) ? (int) $argumentParts[2] : 255;
            }

            ksort($column);

            $columns[] = $column;
        }

        $tables[$tableName] = $columns;
    }

    return $tables;
}

/**
 * Reduce a preset table to the same shape for comparison.
 *
 * @param  array<int, array<string, mixed>>  $columns
 * @return array<int, array<string, mixed>>
 */
function comparableColumns(array $columns): array
{
    return collect($columns)
        ->map(function (array $column) {
            $comparable = [
                'name' => $column['name'],
                'kind' => $column['type']['kind'],
                'isNullable' => $column['isNullable'],
                'keys' => $column['keys'],
            ];

            if (isset($column['type']['length'])) {
                $comparable['length'] = $column['type']['length'];
            }

            ksort($comparable);

            return $comparable;
        })
        ->all();
}

test('every preset column matches the skeleton migration it came from', function () {
    $declared = collect(File::glob(database_path('migrations/0001_01_01_*.php')))
        ->flatMap(fn (string $path) => columnsDeclaredIn($path))
        ->all();

    $preset = collect(config('table_presets'))->firstWhere('key', 'laravel-13');

    expect($declared)->not->toBeEmpty();

    foreach ($preset['tables'] as $table) {
        expect($declared)->toHaveKey($table['name']);

        expect(comparableColumns($table['columns']))
            ->toBe($declared[$table['name']], "The preset's {$table['name']} has drifted from the migration.");
    }
});
