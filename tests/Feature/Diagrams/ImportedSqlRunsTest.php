<?php

use App\Actions\Diagrams\BuildDiagramFromSql;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

afterEach(function () {
    File::deleteDirectory(storage_path('framework/testing'), preserve: true);
});

/**
 * Lay what was read out as a document, the way the canvas does.
 *
 * @param  array{tables: array<int, array<string, mixed>>, relations: array<int, array<string, mixed>>}  $reading
 * @return array<string, mixed>
 */
function documentFromReading(array $reading): array
{
    $nodes = [];
    $columnIdsByTable = [];

    foreach ($reading['tables'] as $tableIndex => $table) {
        $columns = [];

        foreach ($table['columns'] as $columnIndex => $column) {
            $columnId = "col_{$tableIndex}_{$columnIndex}";
            $columnIdsByTable[$table['name']][$column['name']] = $columnId;
            $columns[] = ['id' => $columnId] + $column;
        }

        $nodes[] = [
            'id' => "tbl_{$tableIndex}",
            'type' => 'table',
            'position' => ['x' => $tableIndex * 400, 'y' => 0],
            'data' => [
                'name' => $table['name'],
                'headerColor' => '#6366f1',
                'columns' => $columns,
            ],
        ];
    }

    $tableNodeIds = array_combine(
        array_column($reading['tables'], 'name'),
        array_map(fn (int $index): string => "tbl_{$index}", array_keys($reading['tables'])),
    );

    $edges = [];

    foreach ($reading['relations'] as $relationIndex => $relation) {
        $edges[] = [
            'id' => "rel_{$relationIndex}",
            'source' => $tableNodeIds[$relation['to']['table']],
            'target' => $tableNodeIds[$relation['from']['table']],
            'sourceHandle' => $columnIdsByTable[$relation['to']['table']][$relation['to']['column']].':right',
            'targetHandle' => $columnIdsByTable[$relation['from']['table']][$relation['from']['column']].':left',
            'data' => [
                'cardinality' => 'one-to-many',
                'foreignKeyEnd' => 'target',
                'isConstrained' => $relation['isConstrained'],
            ],
        ];
    }

    return [
        'version' => 1,
        'nodes' => $nodes,
        'edges' => $edges,
        'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
    ];
}

test('a schema read from SQL exports as migrations that build it again', function () {
    $reading = (new BuildDiagramFromSql)->handle(<<<'SQL'
    CREATE TABLE `customers` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `email` varchar(255) NOT NULL,
      `is_active` tinyint(1) NOT NULL DEFAULT 1,
      `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `customers_email_unique` (`email`)
    ) ENGINE=InnoDB;

    CREATE TABLE `orders` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `customer_id` bigint unsigned NOT NULL,
      `total` decimal(10,2) NOT NULL DEFAULT 0.00,
      `status` enum('draft','paid') NOT NULL DEFAULT 'draft',
      `notes` text,
      PRIMARY KEY (`id`),
      KEY `orders_customer_id_index` (`customer_id`),
      CONSTRAINT `orders_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
    ) ENGINE=InnoDB;
    SQL);

    runGeneratedMigrations(documentFromReading($reading));

    expect(Schema::hasColumns('customers', ['id', 'email', 'is_active', 'joined_at']))->toBeTrue()
        ->and(Schema::hasColumns('orders', ['id', 'customer_id', 'total', 'status', 'notes']))->toBeTrue();

    $foreignKeys = collect(Schema::getForeignKeys('orders'));

    expect($foreignKeys)->toHaveCount(1)
        ->and($foreignKeys->first()['foreign_table'])->toBe('customers');

    $indexedColumns = collect(Schema::getIndexes('orders'))->flatMap(fn (array $index) => $index['columns']);

    expect($indexedColumns)->toContain('customer_id');

    DB::table('customers')->insert(['email' => 'someone@example.com']);
    DB::table('orders')->insert(['customer_id' => 1]);

    $order = DB::table('orders')->first();
    $customer = DB::table('customers')->first();

    expect($order->status)->toBe('draft')
        ->and((float) $order->total)->toBe(0.0)
        ->and($customer->is_active)->toBe(1)
        ->and($customer->joined_at)->not->toBeNull();
});
