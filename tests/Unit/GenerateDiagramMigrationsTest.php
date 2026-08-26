<?php

use App\Actions\Diagrams\GenerateDiagramMigrations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Build a table node for the generator to read.
 *
 * @param  array<int, array<string, mixed>>  $columns
 * @return array<string, mixed>
 */
function tableNodeFor(string $nodeId, string $name, array $columns): array
{
    return [
        'id' => $nodeId,
        'type' => 'table',
        'position' => ['x' => 0, 'y' => 0],
        'data' => ['name' => $name, 'headerColor' => '#6366f1', 'columns' => $columns],
    ];
}

/**
 * Build a column for the generator to read.
 *
 * @param  array<string, mixed>  $type
 * @param  array<int, string>  $keys
 * @return array<string, mixed>
 */
function columnFor(string $id, string $name, array $type, array $keys = [], bool $isNullable = false, ?string $defaultValue = null): array
{
    return [
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'isNullable' => $isNullable,
        'keys' => $keys,
        'defaultValue' => $defaultValue,
    ];
}

/**
 * Generate migrations from the given nodes and edges.
 *
 * @param  array<int, array<string, mixed>>  $nodes
 * @param  array<int, array<string, mixed>>  $edges
 * @return array<string, string>
 */
function generateMigrations(array $nodes, array $edges = []): array
{
    return (new GenerateDiagramMigrations)->handle(
        ['version' => 1, 'nodes' => $nodes, 'edges' => $edges, 'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1]],
        CarbonImmutable::parse('2026-03-01 09:00:00'),
    );
}

test('a table becomes a migration that creates and drops it', function () {
    $files = generateMigrations([
        tableNodeFor('tbl_users', 'users', [columnFor('col_id', 'id', ['kind' => 'id'], ['primary'])]),
    ]);

    expect(array_keys($files))->toBe(['2026_03_01_090001_create_users_table.php']);

    $migration = reset($files);

    expect($migration)
        ->toContain("Schema::create('users', function (Blueprint \$table) {")
        ->toContain('$table->id();')
        ->toContain("Schema::dropIfExists('users');");
});

test('every column kind becomes the Blueprint call that creates it', function () {
    $files = generateMigrations([
        tableNodeFor('tbl_orders', 'orders', [
            columnFor('col_id', 'id', ['kind' => 'id'], ['primary']),
            columnFor('col_reference', 'reference', ['kind' => 'string', 'length' => 120], ['unique']),
            columnFor('col_total', 'total', ['kind' => 'decimal', 'precision' => 10, 'scale' => 2]),
            columnFor('col_status', 'status', ['kind' => 'enum', 'values' => ['draft', 'sent']]),
            columnFor('col_notes', 'notes', ['kind' => 'text'], [], true),
            columnFor('col_search', 'search', ['kind' => 'raw', 'definition' => 'tsvector']),
            columnFor('col_placed_at', 'placed_at', ['kind' => 'timestamp'], [], false, 'now'),
        ]),
    ]);

    expect(reset($files))
        ->toContain("\$table->string('reference', 120)->unique();")
        ->toContain("\$table->decimal('total', 10, 2);")
        ->toContain("\$table->enum('status', ['draft', 'sent']);")
        ->toContain("\$table->text('notes')->nullable();")
        ->toContain("\$table->rawColumn('search', 'tsvector');")
        ->toContain("\$table->timestamp('placed_at')->default('now');");
});

test('a foreign key column constrains itself to the table it points at', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_users', 'users', [columnFor('col_users_id', 'id', ['kind' => 'id'], ['primary'])]),
            tableNodeFor('tbl_projects', 'projects', [
                columnFor('col_projects_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_user_id', 'user_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
        ],
        [[
            'id' => 'rel_1',
            'source' => 'tbl_users',
            'target' => 'tbl_projects',
            'sourceHandle' => 'col_users_id:right',
            'targetHandle' => 'col_user_id:left',
            'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
        ]],
    );

    expect($files['2026_03_01_090002_create_projects_table.php'])
        ->toContain("\$table->foreignId('user_id')->constrained('users');");
});

test('a referenced table is created before the table that points at it', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_projects', 'projects', [
                columnFor('col_projects_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_user_id', 'user_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
            tableNodeFor('tbl_users', 'users', [columnFor('col_users_id', 'id', ['kind' => 'id'], ['primary'])]),
        ],
        [[
            'id' => 'rel_1',
            'source' => 'tbl_users',
            'target' => 'tbl_projects',
            'sourceHandle' => 'col_users_id:right',
            'targetHandle' => 'col_user_id:left',
            'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
        ]],
    );

    expect(array_keys($files))->toBe([
        '2026_03_01_090001_create_users_table.php',
        '2026_03_01_090002_create_projects_table.php',
    ]);
});

test('a foreign key on a plain column gets its own constraint line', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_users', 'users', [columnFor('col_users_code', 'code', ['kind' => 'string', 'length' => 20], ['primary'])]),
            tableNodeFor('tbl_visits', 'visits', [
                columnFor('col_visits_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_user_code', 'user_code', ['kind' => 'string', 'length' => 20], ['foreign']),
            ]),
        ],
        [[
            'id' => 'rel_1',
            'source' => 'tbl_users',
            'target' => 'tbl_visits',
            'sourceHandle' => 'col_users_code:right',
            'targetHandle' => 'col_user_code:left',
            'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
        ]],
    );

    expect($files['2026_03_01_090002_create_visits_table.php'])
        ->toContain("\$table->foreign('user_code')->references('code')->on('users');")
        ->and($files['2026_03_01_090002_create_visits_table.php'])
        ->toContain("\$table->string('user_code', 20);");
});

test('a primary key that does not increment says so', function () {
    $files = generateMigrations([
        tableNodeFor('tbl_settings', 'settings', [columnFor('col_key', 'key', ['kind' => 'string', 'length' => 64], ['primary'])]),
    ]);

    expect(reset($files))->toContain("\$table->string('key', 64)->primary();");
});

test('sticky notes are not tables and produce nothing', function () {
    $files = generateMigrations([[
        'id' => 'note_1',
        'type' => 'stickyNote',
        'position' => ['x' => 0, 'y' => 0],
        'data' => ['text' => 'remember this', 'color' => '#fef08a'],
    ]]);

    expect($files)->toBe([]);
});

test('tables pointing at each other still all get generated', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_a', 'authors', [
                columnFor('col_a_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_a_book', 'favourite_book_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
            tableNodeFor('tbl_b', 'books', [
                columnFor('col_b_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_b_author', 'author_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
        ],
        [
            [
                'id' => 'rel_1', 'source' => 'tbl_b', 'target' => 'tbl_a',
                'sourceHandle' => 'col_b_id:right', 'targetHandle' => 'col_a_book:left',
                'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
            ],
            [
                'id' => 'rel_2', 'source' => 'tbl_a', 'target' => 'tbl_b',
                'sourceHandle' => 'col_a_id:right', 'targetHandle' => 'col_b_author:left',
                'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
            ],
        ],
    );

    expect($files)->toHaveCount(2);
});

test('a modifier reaches the column and not the foreign key it constrains', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_users', 'users', [columnFor('col_u_id', 'id', ['kind' => 'id'], ['primary'])]),
            tableNodeFor('tbl_staff', 'staff', [
                columnFor('col_s_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_manager', 'manager_id', ['kind' => 'foreignId'], ['foreign'], true),
            ]),
        ],
        [[
            'id' => 'rel_1', 'source' => 'tbl_users', 'target' => 'tbl_staff',
            'sourceHandle' => 'col_u_id:right', 'targetHandle' => 'col_manager:left',
            'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target'],
        ]],
    );

    expect($files['2026_03_01_090002_create_staff_table.php'])
        ->toContain("\$table->foreignId('manager_id')->nullable()->constrained('users');");
});

test('float and double get only the arguments Laravel accepts', function () {
    $files = generateMigrations([
        tableNodeFor('tbl_readings', 'readings', [
            columnFor('col_a', 'ratio', ['kind' => 'float', 'precision' => 12, 'scale' => 4]),
            columnFor('col_b', 'measure', ['kind' => 'double', 'precision' => 12, 'scale' => 4]),
            columnFor('col_c', 'total', ['kind' => 'decimal', 'precision' => 12, 'scale' => 4]),
        ]),
    ]);

    expect(reset($files))
        ->toContain("\$table->float('ratio', 12);")
        ->toContain("\$table->double('measure');")
        ->toContain("\$table->decimal('total', 12, 4);");
});

test('a type missing its parameter still produces PHP that parses', function () {
    $files = generateMigrations([
        tableNodeFor('tbl_things', 'things', [
            columnFor('col_a', 'label', ['kind' => 'string']),
            columnFor('col_b', 'amount', ['kind' => 'decimal']),
            columnFor('col_c', 'choice', ['kind' => 'enum']),
        ]),
    ]);

    $migration = reset($files);

    expect($migration)
        ->toContain("\$table->string('label', 255);")
        ->toContain("\$table->decimal('amount', 8, 2);");

    $file = tempnam(sys_get_temp_dir(), 'generated').'.php';
    file_put_contents($file, $migration);
    exec('php -l '.escapeshellarg($file), $output, $exitCode);
    unlink($file);

    expect($exitCode)->toBe(0);
});

test('tables queued behind a cycle keep an order the database can accept', function () {
    $files = generateMigrations(
        [
            tableNodeFor('tbl_leaf', 'leaf', [
                columnFor('col_leaf_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_leaf_middle', 'middle_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
            tableNodeFor('tbl_middle', 'middle', [
                columnFor('col_middle_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_middle_a', 'a_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
            tableNodeFor('tbl_a', 'a', [
                columnFor('col_a_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_a_b', 'b_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
            tableNodeFor('tbl_b', 'b', [
                columnFor('col_b_id', 'id', ['kind' => 'id'], ['primary']),
                columnFor('col_b_a', 'a_id', ['kind' => 'foreignId'], ['foreign']),
            ]),
        ],
        [
            ['id' => 'r1', 'source' => 'tbl_middle', 'target' => 'tbl_leaf', 'sourceHandle' => 'col_middle_id:right', 'targetHandle' => 'col_leaf_middle:left', 'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target']],
            ['id' => 'r2', 'source' => 'tbl_a', 'target' => 'tbl_middle', 'sourceHandle' => 'col_a_id:right', 'targetHandle' => 'col_middle_a:left', 'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target']],
            ['id' => 'r3', 'source' => 'tbl_b', 'target' => 'tbl_a', 'sourceHandle' => 'col_b_id:right', 'targetHandle' => 'col_a_b:left', 'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target']],
            ['id' => 'r4', 'source' => 'tbl_a', 'target' => 'tbl_b', 'sourceHandle' => 'col_a_id:right', 'targetHandle' => 'col_b_a:left', 'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target']],
        ],
    );

    $order = array_map(
        fn (string $filename) => Str::of($filename)->after('_create_')->before('_table.php')->toString(),
        array_keys($files),
    );

    expect(array_search('middle', $order, true))->toBeLessThan(array_search('leaf', $order, true))
        ->and(array_search('a', $order, true))->toBeLessThan(array_search('middle', $order, true));
});

test('a relation that only references does not become a constraint', function () {
    $nodes = [
        tableNodeFor('tbl_users', 'users', [columnFor('col_u_id', 'id', ['kind' => 'id'], ['primary'])]),
        tableNodeFor('tbl_sessions', 'sessions', [
            columnFor('col_s_id', 'id', ['kind' => 'string', 'length' => 255], ['primary']),
            columnFor('col_s_user', 'user_id', ['kind' => 'foreignId'], [], true),
        ]),
    ];

    $edge = [
        'id' => 'rel_1',
        'source' => 'tbl_users',
        'target' => 'tbl_sessions',
        'sourceHandle' => 'col_u_id:right',
        'targetHandle' => 'col_s_user:left',
        'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target', 'isConstrained' => false],
    ];

    $files = generateMigrations($nodes, [$edge]);
    $sessions = collect($files)->first(fn (string $contents) => str_contains($contents, "Schema::create('sessions'"));

    expect($sessions)
        ->toContain("\$table->foreignId('user_id')->nullable();")
        ->not->toContain('constrained')
        ->not->toContain('->foreign(');
});

test('an unenforced relation does not force the table order', function () {
    $nodes = [
        tableNodeFor('tbl_sessions', 'sessions', [
            columnFor('col_s_id', 'id', ['kind' => 'string', 'length' => 255], ['primary']),
            columnFor('col_s_user', 'user_id', ['kind' => 'foreignId'], [], true),
        ]),
        tableNodeFor('tbl_users', 'users', [columnFor('col_u_id', 'id', ['kind' => 'id'], ['primary'])]),
    ];

    $edge = [
        'id' => 'rel_1',
        'source' => 'tbl_users',
        'target' => 'tbl_sessions',
        'sourceHandle' => 'col_u_id:right',
        'targetHandle' => 'col_s_user:left',
        'data' => ['cardinality' => 'one-to-many', 'foreignKeyEnd' => 'target', 'isConstrained' => false],
    ];

    $order = array_map(
        fn (string $filename) => Str::of($filename)->after('_create_')->before('_table.php')->toString(),
        array_keys(generateMigrations($nodes, [$edge])),
    );

    expect($order)->toBe(['sessions', 'users']);
});
