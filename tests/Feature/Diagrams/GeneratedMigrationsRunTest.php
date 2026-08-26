<?php

use App\Actions\Diagrams\GenerateDiagramMigrations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Write the generated migrations to a throwaway directory and run them.
 *
 * String matching only proves the generator wrote what was expected; running the
 * files is the only thing that proves Laravel accepts them.
 *
 * @param  array<string, mixed>  $document
 */
function runGeneratedMigrations(array $document): string
{
    $directory = storage_path('framework/testing/generated-migrations-'.Str::random(8));

    File::ensureDirectoryExists($directory);

    foreach ((new GenerateDiagramMigrations)->handle($document, CarbonImmutable::parse('2026-03-01 09:00:00')) as $filename => $contents) {
        File::put($directory.'/'.$filename, $contents);
    }

    test()->artisan('migrate', ['--path' => $directory, '--realpath' => true])->assertSuccessful();

    return $directory;
}

afterEach(function () {
    File::deleteDirectory(storage_path('framework/testing'), preserve: true);
});

test('the generated migrations actually run and build the schema', function () {
    $document = [
        'version' => 1,
        'nodes' => [
            [
                'id' => 'tbl_projects',
                'type' => 'table',
                'position' => ['x' => 0, 'y' => 0],
                'data' => ['name' => 'client_projects', 'headerColor' => '#10b981', 'columns' => [
                    ['id' => 'col_p_id', 'name' => 'id', 'type' => ['kind' => 'id'], 'isNullable' => false, 'keys' => ['primary'], 'defaultValue' => null],
                    ['id' => 'col_p_owner', 'name' => 'owner_id', 'type' => ['kind' => 'foreignId'], 'isNullable' => false, 'keys' => ['foreign'], 'defaultValue' => null],
                    ['id' => 'col_p_ref', 'name' => 'reference', 'type' => ['kind' => 'string', 'length' => 40], 'isNullable' => false, 'keys' => ['unique'], 'defaultValue' => null],
                    ['id' => 'col_p_total', 'name' => 'total', 'type' => ['kind' => 'decimal', 'precision' => 10, 'scale' => 2], 'isNullable' => true, 'keys' => [], 'defaultValue' => null],
                    ['id' => 'col_p_status', 'name' => 'status', 'type' => ['kind' => 'enum', 'values' => ['draft', 'sent']], 'isNullable' => false, 'keys' => [], 'defaultValue' => null],
                ]],
            ],
            [
                'id' => 'tbl_owners',
                'type' => 'table',
                'position' => ['x' => 400, 'y' => 0],
                'data' => ['name' => 'owners', 'headerColor' => '#6366f1', 'columns' => [
                    ['id' => 'col_o_id', 'name' => 'id', 'type' => ['kind' => 'id'], 'isNullable' => false, 'keys' => ['primary'], 'defaultValue' => null],
                    ['id' => 'col_o_name', 'name' => 'name', 'type' => ['kind' => 'string', 'length' => 255], 'isNullable' => false, 'keys' => [], 'defaultValue' => null],
                ]],
            ],
        ],
        'edges' => [[
            'id' => 'rel_1',
            'source' => 'tbl_owners',
            'target' => 'tbl_projects',
            'sourceHandle' => 'col_o_id:right',
            'targetHandle' => 'col_p_owner:left',
            'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
        ]],
    ];

    runGeneratedMigrations($document);

    expect(Schema::hasTable('owners'))->toBeTrue()
        ->and(Schema::hasTable('client_projects'))->toBeTrue()
        ->and(Schema::hasColumns('client_projects', ['id', 'owner_id', 'reference', 'total', 'status']))->toBeTrue();

    $foreignKeys = collect(Schema::getForeignKeys('client_projects'));

    expect($foreignKeys)->toHaveCount(1)
        ->and($foreignKeys->first()['foreign_table'])->toBe('owners');
});

test('a raw column definition the database understands still runs', function () {
    runGeneratedMigrations([
        'version' => 1,
        'nodes' => [[
            'id' => 'tbl_things',
            'type' => 'table',
            'position' => ['x' => 0, 'y' => 0],
            'data' => ['name' => 'things', 'headerColor' => '#6366f1', 'columns' => [
                ['id' => 'col_id', 'name' => 'id', 'type' => ['kind' => 'id'], 'isNullable' => false, 'keys' => ['primary'], 'defaultValue' => null],
                ['id' => 'col_raw', 'name' => 'payload', 'type' => ['kind' => 'raw', 'definition' => 'blob'], 'isNullable' => true, 'keys' => [], 'defaultValue' => null],
            ]],
        ]],
        'edges' => [],
    ]);

    expect(Schema::hasColumns('things', ['id', 'payload']))->toBeTrue();
});
