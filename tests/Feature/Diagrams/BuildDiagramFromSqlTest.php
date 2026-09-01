<?php

use App\Actions\Diagrams\BuildDiagramFromSql;
use App\Http\Requests\Diagrams\UpdateDiagramDocumentRequest;

/**
 * Read SQL and hand back what was found.
 *
 * @return array{tables: array<int, array<string, mixed>>, relations: array<int, array<string, mixed>>, skipped: array<int, string>}
 */
function readSql(string $sql): array
{
    return (new BuildDiagramFromSql)->handle($sql);
}

/**
 * Get one table's columns keyed by name, for asking about one at a time.
 *
 * @param  array<string, mixed>  $result
 * @return array<string, array<string, mixed>>
 */
function columnsOf(array $result, string $tableName): array
{
    $table = collect($result['tables'])->firstWhere('name', $tableName);

    return collect($table['columns'] ?? [])->keyBy('name')->all();
}

test('a create table statement becomes a table with its columns', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE `users` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `name` varchar(255) NOT NULL,
      `email` varchar(255) NOT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `users_email_unique` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    SQL);

    expect($result['tables'])->toHaveCount(1)
        ->and($result['tables'][0]['name'])->toBe('users');

    $columns = columnsOf($result, 'users');

    expect(array_keys($columns))->toBe(['id', 'name', 'email'])
        ->and($columns['id']['type'])->toBe(['kind' => 'id'])
        ->and($columns['id']['keys'])->toBe(['primary'])
        ->and($columns['name']['type'])->toBe(['kind' => 'string', 'length' => 255])
        ->and($columns['name']['isNullable'])->toBeFalse()
        ->and($columns['email']['keys'])->toBe(['unique']);
});

test('every kind of type is read as the kind it is', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE things (
      counted int unsigned NOT NULL,
      small tinyint NOT NULL,
      flagged tinyint(1) NOT NULL,
      total decimal(10,2) NOT NULL,
      label char(36) NOT NULL,
      story longtext NULL,
      shape enum('draft','sent') NOT NULL,
      payload json NULL,
      happened_at timestamp NULL,
      identifier uuid NOT NULL,
      picture blob NULL
    );
    SQL);

    $columns = columnsOf($result, 'things');

    expect($columns['counted']['type'])->toBe(['kind' => 'unsignedInteger'])
        ->and($columns['small']['type'])->toBe(['kind' => 'tinyInteger'])
        ->and($columns['flagged']['type'])->toBe(['kind' => 'boolean'])
        ->and($columns['total']['type'])->toBe(['kind' => 'decimal', 'precision' => 10, 'scale' => 2])
        ->and($columns['label']['type'])->toBe(['kind' => 'char', 'length' => 36])
        ->and($columns['story']['type'])->toBe(['kind' => 'longText'])
        ->and($columns['shape']['type'])->toBe(['kind' => 'enum', 'values' => ['draft', 'sent']])
        ->and($columns['payload']['type'])->toBe(['kind' => 'json'])
        ->and($columns['happened_at']['type'])->toBe(['kind' => 'timestamp'])
        ->and($columns['identifier']['type'])->toBe(['kind' => 'uuid'])
        ->and($columns['picture']['type'])->toBe(['kind' => 'binary']);
});

test('a column that can hold nothing is read as one', function () {
    $result = readSql('CREATE TABLE notes (body text NULL, title varchar(80) NOT NULL);');

    $columns = columnsOf($result, 'notes');

    expect($columns['body']['isNullable'])->toBeTrue()
        ->and($columns['title']['isNullable'])->toBeFalse();
});

test('defaults are read, including the ones the database fills in', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE orders (
      status varchar(20) NOT NULL DEFAULT 'draft',
      attempts int NOT NULL DEFAULT 0,
      failed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at timestamp NULL DEFAULT NULL
    );
    SQL);

    $columns = columnsOf($result, 'orders');

    expect($columns['status']['defaultValue'])->toBe(['kind' => 'literal', 'value' => 'draft'])
        ->and($columns['attempts']['defaultValue'])->toBe(['kind' => 'literal', 'value' => '0'])
        ->and($columns['failed_at']['defaultValue'])->toBe(['kind' => 'currentTimestamp'])
        ->and($columns['cancelled_at']['defaultValue'])->toBe(['kind' => 'none']);
});

test('an index declared under the columns lands on the column it names', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE sessions (
      id varchar(255) NOT NULL,
      user_id bigint unsigned NULL,
      last_activity int NOT NULL,
      PRIMARY KEY (id),
      KEY sessions_user_id_index (user_id),
      KEY sessions_last_activity_index (last_activity)
    );
    SQL);

    $columns = columnsOf($result, 'sessions');

    expect($columns['id']['keys'])->toBe(['primary'])
        ->and($columns['user_id']['keys'])->toBe(['index'])
        ->and($columns['last_activity']['keys'])->toBe(['index']);
});

test('a foreign key becomes a relation between the two tables', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE users (id bigint unsigned NOT NULL AUTO_INCREMENT, PRIMARY KEY (id));
    CREATE TABLE posts (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      author_id bigint unsigned NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT posts_author_id_foreign FOREIGN KEY (author_id) REFERENCES users (id)
    );
    SQL);

    expect($result['relations'])->toBe([[
        'from' => ['table' => 'posts', 'column' => 'author_id'],
        'to' => ['table' => 'users', 'column' => 'id'],
        'isConstrained' => true,
    ]]);
});

test('a foreign key added afterwards is read too', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE users (id bigint unsigned NOT NULL AUTO_INCREMENT, PRIMARY KEY (id));
    CREATE TABLE posts (id bigint unsigned NOT NULL, author_id bigint unsigned NOT NULL);
    ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_foreign` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`);
    SQL);

    expect($result['relations'])->toHaveCount(1)
        ->and($result['relations'][0]['from'])->toBe(['table' => 'posts', 'column' => 'author_id']);
});

test('a relation pointing outside what was read is left out and said so', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE posts (
      id bigint unsigned NOT NULL,
      author_id bigint unsigned NOT NULL,
      CONSTRAINT posts_author_id_foreign FOREIGN KEY (author_id) REFERENCES users (id)
    );
    SQL);

    expect($result['relations'])->toBe([])
        ->and($result['skipped'])->toContain('A relation from posts was left out: it points at something this SQL does not create.');
});

test('a key spanning several columns is left out and said so', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE failed_jobs (
      connection text NOT NULL,
      queue text NOT NULL,
      failed_at timestamp NOT NULL,
      KEY failed_jobs_index (connection, queue, failed_at)
    );
    SQL);

    expect($result['skipped'])->toContain('A index on failed_jobs spanning several columns was left out: a diagram cannot draw one yet.')
        ->and(columnsOf($result, 'failed_jobs')['connection']['keys'])->toBe([]);
});

test('comments and the settings a dump carries are ignored', function () {
    $result = readSql(<<<'SQL'
    -- MySQL dump 10.13
    /*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
    # another comment
    /* a block
       comment */
    CREATE TABLE tags (id int NOT NULL, label varchar(40) NOT NULL);
    SQL);

    expect($result['tables'])->toHaveCount(1)
        ->and(array_keys(columnsOf($result, 'tags')))->toBe(['id', 'label']);
});

test('a semicolon inside a default does not cut the statement in half', function () {
    $result = readSql("CREATE TABLE quotes (id int NOT NULL, saying varchar(50) NOT NULL DEFAULT 'one; two');");

    expect($result['tables'])->toHaveCount(1)
        ->and(array_keys(columnsOf($result, 'quotes')))->toBe(['id', 'saying']);
});

test('a type this tool has no name for is kept as it was written', function () {
    $result = readSql('CREATE TABLE places (id int NOT NULL, area polygon NOT NULL);');

    expect(columnsOf($result, 'places')['area']['type'])
        ->toBe(['kind' => 'raw', 'definition' => 'polygon']);
});

test('a name a diagram cannot carry is left out and said so', function () {
    $result = readSql('CREATE TABLE `odd;name` (id int NOT NULL);');

    expect($result['tables'])->toBe([])
        ->and($result['skipped'][0])->toContain('the name has characters a diagram cannot carry');
});

test('a default a diagram cannot carry is dropped, keeping the column', function () {
    $result = readSql("CREATE TABLE notes (body varchar(50) NOT NULL DEFAULT 'it''s here');");

    expect(columnsOf($result, 'notes')['body']['defaultValue'])->toBe(['kind' => 'none'])
        ->and($result['skipped'][0])->toContain('was left out');
});

test('anything that is not a table is passed over', function () {
    $result = readSql(<<<'SQL'
    CREATE VIEW recent_posts AS SELECT * FROM posts;
    INSERT INTO posts (id) VALUES (1);
    CREATE TABLE posts (id int NOT NULL);
    SQL);

    expect($result['tables'])->toHaveCount(1)
        ->and($result['tables'][0]['name'])->toBe('posts');
});

test('nothing at all is read from text that holds no tables', function () {
    expect(readSql('SELECT 1;'))->toBe(['tables' => [], 'relations' => [], 'skipped' => []]);
});

test('a postgres dump is read, schema prefix and all', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE public.users (
        id bigserial NOT NULL,
        email character varying(255) NOT NULL,
        rating double precision,
        seen_at timestamp with time zone,
        payload bytea
    );
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    SQL);

    $columns = columnsOf($result, 'users');

    expect($result['tables'])->toHaveCount(1)
        ->and($result['tables'][0]['name'])->toBe('users')
        ->and($columns['email']['type'])->toBe(['kind' => 'string', 'length' => 255])
        ->and($columns['rating']['type'])->toBe(['kind' => 'double'])
        ->and($columns['seen_at']['type'])->toBe(['kind' => 'timestampTz'])
        ->and($columns['payload']['type'])->toBe(['kind' => 'binary']);
});

test('a default that begins like a comment does not swallow the rest', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE themes (
      colour varchar(7) NOT NULL DEFAULT '#ffffff',
      label varchar(40) NOT NULL
    );
    SQL);

    $columns = columnsOf($result, 'themes');

    expect(array_keys($columns))->toBe(['colour', 'label'])
        ->and($columns['colour']['type'])->toBe(['kind' => 'string', 'length' => 7])
        ->and($columns['colour']['isNullable'])->toBeFalse();
});

test('a unique column may still hold nothing', function () {
    $result = readSql('CREATE TABLE people (nickname varchar(30) UNIQUE, id int NOT NULL PRIMARY KEY);');

    $columns = columnsOf($result, 'people');

    expect($columns['nickname']['keys'])->toBe(['unique'])
        ->and($columns['nickname']['isNullable'])->toBeTrue()
        ->and($columns['id']['isNullable'])->toBeFalse();
});

test('float and double keep the width the schema asked for', function () {
    $result = readSql('CREATE TABLE readings (light float NOT NULL, heavy double NOT NULL, small real NOT NULL);');

    $columns = columnsOf($result, 'readings');

    expect($columns['light']['type'])->toBe(['kind' => 'float', 'precision' => 24])
        ->and($columns['heavy']['type'])->toBe(['kind' => 'double'])
        ->and($columns['small']['type'])->toBe(['kind' => 'float', 'precision' => 24]);
});

test('char with nothing in brackets is a single character', function () {
    $result = readSql('CREATE TABLE flags (mark char NOT NULL, code char(3) NOT NULL);');

    $columns = columnsOf($result, 'flags');

    expect($columns['mark']['type'])->toBe(['kind' => 'char', 'length' => 1])
        ->and($columns['code']['type'])->toBe(['kind' => 'char', 'length' => 3]);
});

test('a relation dropped by an alter table is said out loud', function () {
    $result = readSql(<<<'SQL'
    CREATE TABLE parts (id int NOT NULL, left_id int NOT NULL, right_id int NOT NULL);
    ALTER TABLE parts ADD CONSTRAINT parts_pair_foreign FOREIGN KEY (left_id, right_id) REFERENCES pairs (a, b);
    SQL);

    expect($result['relations'])->toBe([])
        ->and($result['skipped'])->toContain('A relation on parts spanning several columns was left out: a diagram cannot draw one yet.');
});

test('a key naming no columns is passed over rather than crashing', function () {
    $shapes = [
        'CREATE TABLE a (b int, PRIMARY KEY ( ));',
        'CREATE TABLE a (b int, KEY ( , ));',
        'CREATE TABLE a (b int, FOREIGN KEY ( ) REFERENCES t ( ));',
        'CREATE TABLE a (b int); ALTER TABLE a ADD FOREIGN KEY ( ) REFERENCES t ( );',
    ];

    foreach ($shapes as $sql) {
        $result = readSql($sql);

        expect($result['tables'])->toHaveCount(1, "on: {$sql}")
            ->and($result['relations'])->toBe([], "on: {$sql}");
    }
});

test('more relations than a diagram may hold are cut back and said so', function () {
    $alters = str_repeat(
        'ALTER TABLE a ADD FOREIGN KEY (b) REFERENCES a (b);',
        UpdateDiagramDocumentRequest::MAXIMUM_EDGES + 10,
    );

    $result = readSql('CREATE TABLE a (b int NOT NULL);'.$alters);

    expect($result['relations'])->toHaveCount(UpdateDiagramDocumentRequest::MAXIMUM_EDGES)
        ->and($result['skipped'])->toContain('Only the first '.UpdateDiagramDocumentRequest::MAXIMUM_EDGES.' relations were read: a diagram holds no more than that.');
});

test('more allowed values than a column may hold are cut back and said so', function () {
    $values = collect(range(1, UpdateDiagramDocumentRequest::MAXIMUM_ENUM_VALUES + 5))
        ->map(fn (int $number): string => "'value{$number}'")
        ->implode(',');

    $result = readSql("CREATE TABLE a (b enum({$values}) NOT NULL);");

    expect(columnsOf($result, 'a')['b']['type']['values'])
        ->toHaveCount(UpdateDiagramDocumentRequest::MAXIMUM_ENUM_VALUES)
        ->and($result['skipped'][0])->toContain('Only the first');
});
