<?php

namespace App\Actions\Diagrams;

use App\Enums\ColumnDefaultKind;
use App\Enums\ColumnKeyKind;
use App\Enums\ColumnKind;
use App\Http\Requests\Diagrams\UpdateDiagramDocumentRequest;
use Illuminate\Support\Str;

/**
 * Read `CREATE TABLE` statements and describe the diagram they draw.
 *
 * The result is shaped exactly like a table preset — tables and relations, with
 * no positions and no ids — because the canvas already knows how to lay a preset
 * out and give its parts ids. Reading SQL and placing boxes are two jobs, and
 * this is only the first.
 *
 * What cannot be represented is reported rather than guessed at. A diagram that
 * quietly differs from the schema it was read from is worse than one that says
 * which parts it had to leave behind.
 */
class BuildDiagramFromSql
{
    /**
     * Types written the same way by every database this is likely to meet.
     *
     * Anything absent falls through to `raw`, which the exporter writes out
     * verbatim: unknown is not the same as wrong.
     *
     * @var array<string, string>
     */
    protected const TYPE_NAMES = [
        'tinyint' => ColumnKind::TinyInteger->value,
        'smallint' => ColumnKind::SmallInteger->value,
        'mediumint' => ColumnKind::MediumInteger->value,
        'int' => ColumnKind::Integer->value,
        'integer' => ColumnKind::Integer->value,
        'bigint' => ColumnKind::BigInteger->value,
        'decimal' => ColumnKind::Decimal->value,
        'numeric' => ColumnKind::Decimal->value,
        'float' => ColumnKind::Float->value,
        'double' => ColumnKind::Double->value,
        'real' => ColumnKind::Float->value,
        'char' => ColumnKind::Char->value,
        'character' => ColumnKind::Char->value,
        'varchar' => ColumnKind::String->value,
        'tinytext' => ColumnKind::TinyText->value,
        'text' => ColumnKind::Text->value,
        'mediumtext' => ColumnKind::MediumText->value,
        'longtext' => ColumnKind::LongText->value,
        'boolean' => ColumnKind::Boolean->value,
        'bool' => ColumnKind::Boolean->value,
        'enum' => ColumnKind::Enum->value,
        'set' => ColumnKind::Set->value,
        'json' => ColumnKind::Json->value,
        'jsonb' => ColumnKind::Jsonb->value,
        'date' => ColumnKind::Date->value,
        'datetime' => ColumnKind::DateTime->value,
        'timestamp' => ColumnKind::Timestamp->value,
        'timestamptz' => ColumnKind::TimestampTz->value,
        'time' => ColumnKind::Time->value,
        'year' => ColumnKind::Year->value,
        'uuid' => ColumnKind::Uuid->value,
        'ulid' => ColumnKind::Ulid->value,
        'inet' => ColumnKind::IpAddress->value,
        'binary' => ColumnKind::Binary->value,
        'varbinary' => ColumnKind::Binary->value,
        'blob' => ColumnKind::Binary->value,
        'longblob' => ColumnKind::Binary->value,
        'mediumblob' => ColumnKind::Binary->value,
        'tinyblob' => ColumnKind::Binary->value,
        'bytea' => ColumnKind::Binary->value,
        'geometry' => ColumnKind::Geometry->value,
        'geography' => ColumnKind::Geography->value,
        'vector' => ColumnKind::Vector->value,
        'tsvector' => ColumnKind::Tsvector->value,
    ];

    /**
     * Integer types by the width they hold, so `unsigned` can pick its own.
     *
     * @var array<string, string>
     */
    protected const UNSIGNED_TYPE_NAMES = [
        ColumnKind::TinyInteger->value => ColumnKind::UnsignedTinyInteger->value,
        ColumnKind::SmallInteger->value => ColumnKind::UnsignedSmallInteger->value,
        ColumnKind::MediumInteger->value => ColumnKind::UnsignedMediumInteger->value,
        ColumnKind::Integer->value => ColumnKind::UnsignedInteger->value,
        ColumnKind::BigInteger->value => ColumnKind::UnsignedBigInteger->value,
    ];

    /**
     * Turn SQL into the tables and relations it describes.
     *
     * @return array{
     *     tables: array<int, array<string, mixed>>,
     *     relations: array<int, array<string, mixed>>,
     *     skipped: array<int, string>
     * }
     */
    public function handle(string $sql): array
    {
        $skipped = [];
        $tables = [];
        $foreignKeys = [];

        foreach ($this->statementsIn($sql) as $statement) {
            if (preg_match('/^\s*CREATE\s+(?:TEMPORARY\s+)?TABLE/i', $statement) === 1) {
                $table = $this->tableFrom($statement, $skipped, $foreignKeys);

                if ($table !== null) {
                    $tables[] = $table;
                }

                continue;
            }

            if (preg_match('/^\s*ALTER\s+TABLE/i', $statement) === 1) {
                $this->readAlterTable($statement, $foreignKeys, $skipped);
            }
        }

        $relations = $this->relationsAmong($tables, $foreignKeys, $skipped);

        if (count($relations) > UpdateDiagramDocumentRequest::MAXIMUM_EDGES) {
            $skipped[] = __('Only the first :count relations were read: a diagram holds no more than that.', [
                'count' => UpdateDiagramDocumentRequest::MAXIMUM_EDGES,
            ]);

            $relations = array_slice($relations, 0, UpdateDiagramDocumentRequest::MAXIMUM_EDGES);
        }

        return [
            'tables' => $tables,
            'relations' => $relations,
            'skipped' => array_values(array_unique($skipped)),
        ];
    }

    /**
     * Cut the text into statements, leaving its comments behind.
     *
     * Comments are taken out here rather than beforehand, because only a walk
     * that follows quotes can tell a comment from a value: `DEFAULT '#ffffff'`
     * begins with the character that starts a comment, and stripping it first
     * swallowed the rest of the line — the column, and the one after it.
     *
     * MySQL hides real statements inside `/*!40101 ... *\/`, so those keep their
     * contents.
     *
     * @return array<int, string>
     */
    protected function statementsIn(string $sql): array
    {
        $statements = [];
        $current = '';
        $quote = null;
        $length = strlen($sql);

        for ($position = 0; $position < $length; $position++) {
            $character = $sql[$position];
            $next = $sql[$position + 1] ?? '';

            if ($quote !== null) {
                $current .= $character;

                if ($character === $quote) {
                    $quote = null;
                }

                continue;
            }

            if ($character === "'" || $character === '"' || $character === '`') {
                $quote = $character;
                $current .= $character;

                continue;
            }

            if ($character === '#' || ($character === '-' && $next === '-')) {
                $position = $this->endOfLine($sql, $position);

                continue;
            }

            if ($character === '/' && $next === '*') {
                [$position, $kept] = $this->endOfBlockComment($sql, $position);
                $current .= $kept;

                continue;
            }

            if ($character === ';') {
                $statements[] = $current;
                $current = '';

                continue;
            }

            $current .= $character;
        }

        $statements[] = $current;

        return array_values(array_filter(
            array_map(trim(...), $statements),
            fn (string $statement): bool => $statement !== '',
        ));
    }

    /**
     * Where the line holding this position ends.
     */
    protected function endOfLine(string $sql, int $position): int
    {
        $newline = strpos($sql, "\n", $position);

        return $newline === false ? strlen($sql) : $newline;
    }

    /**
     * Where the block comment at this position ends, and what of it to keep.
     *
     * @return array{0: int, 1: string} the position to carry on from, and the SQL the comment was hiding
     */
    protected function endOfBlockComment(string $sql, int $position): array
    {
        $end = strpos($sql, '*/', $position + 2);
        $finish = $end === false ? strlen($sql) : $end + 1;
        $inside = substr($sql, $position + 2, ($end === false ? strlen($sql) : $end) - $position - 2);

        // `/*!40101 SET ... */` is a statement MySQL hides from other databases.
        $kept = preg_match('/^!\d*\s?(.*)$/s', $inside, $parts) === 1 ? $parts[1] : ' ';

        return [$finish, $kept];
    }

    /**
     * Read one `CREATE TABLE` statement.
     *
     * @param  array<int, string>  $skipped
     * @param  array<int, array<string, string>>  $foreignKeys
     * @return array<string, mixed>|null
     */
    protected function tableFrom(string $statement, array &$skipped, array &$foreignKeys): ?array
    {
        if (preg_match('/CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\((.*)\)[^)]*$/is', $statement, $parts) !== 1) {
            return null;
        }

        $tableName = $this->plainName($parts[1]);

        if (! $this->isNameWeCanDraw($tableName)) {
            $skipped[] = __('Table ":name" was left out: the name has characters a diagram cannot carry.', [
                'name' => Str::limit($tableName, 30),
            ]);

            return null;
        }

        $columns = [];
        $keysByColumn = [];

        foreach ($this->partsOf($parts[2]) as $line) {
            if ($this->readTableConstraint($line, $tableName, $keysByColumn, $foreignKeys, $skipped)) {
                continue;
            }

            $column = $this->columnFrom($line, $tableName, $skipped);

            if ($column !== null) {
                $columns[] = $column;
            }
        }

        if ($columns === []) {
            return null;
        }

        if (count($columns) > UpdateDiagramDocumentRequest::MAXIMUM_COLUMNS_PER_TABLE) {
            $skipped[] = __('Only the first :count columns of :table were read: a diagram holds no more than that.', [
                'count' => UpdateDiagramDocumentRequest::MAXIMUM_COLUMNS_PER_TABLE,
                'table' => $tableName,
            ]);

            $columns = array_slice($columns, 0, UpdateDiagramDocumentRequest::MAXIMUM_COLUMNS_PER_TABLE);
        }

        foreach ($columns as $index => $column) {
            foreach ($keysByColumn[Str::lower($column['name'])] ?? [] as $key) {
                if (! in_array($key, $columns[$index]['keys'], true)) {
                    $columns[$index]['keys'][] = $key;
                }
            }

            // A primary key holds a value whether or not the line said so.
            if (in_array(ColumnKeyKind::Primary->value, $columns[$index]['keys'], true)) {
                $columns[$index]['isNullable'] = false;
            }
        }

        return ['name' => $tableName, 'columns' => $columns];
    }

    /**
     * Cut a `CREATE TABLE` body into its lines.
     *
     * Only the commas outside brackets and quotes separate one line from the
     * next: `decimal(10, 2)` and `enum('a', 'b')` hold their own.
     *
     * @return array<int, string>
     */
    protected function partsOf(string $body): array
    {
        $parts = [];
        $current = '';
        $depth = 0;
        $quote = null;

        foreach (str_split($body) as $character) {
            if ($quote !== null) {
                $current .= $character;

                if ($character === $quote) {
                    $quote = null;
                }

                continue;
            }

            if ($character === "'" || $character === '"' || $character === '`') {
                $quote = $character;
                $current .= $character;

                continue;
            }

            if ($character === '(') {
                $depth++;
            }

            if ($character === ')') {
                $depth--;
            }

            if ($character === ',' && $depth === 0) {
                $parts[] = trim($current);
                $current = '';

                continue;
            }

            $current .= $character;
        }

        $parts[] = trim($current);

        return array_values(array_filter($parts, fn (string $part): bool => $part !== ''));
    }

    /**
     * Read a line that describes keys rather than a column.
     *
     * @param  array<string, array<int, string>>  $keysByColumn
     * @param  array<int, array<string, string>>  $foreignKeys
     * @param  array<int, string>  $skipped
     * @return bool whether the line was one
     */
    protected function readTableConstraint(
        string $line,
        string $tableName,
        array &$keysByColumn,
        array &$foreignKeys,
        array &$skipped,
    ): bool {
        if (preg_match('/^(?:CONSTRAINT\s+\S+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i', $line, $parts) === 1) {
            $this->rememberForeignKey($tableName, $parts[1], $parts[2], $parts[3], $foreignKeys, $skipped);

            return true;
        }

        if (preg_match('/^(?:CONSTRAINT\s+\S+\s+)?(PRIMARY\s+KEY|UNIQUE(?:\s+KEY|\s+INDEX)?|KEY|INDEX)\s*(?:\S+\s*)?\(([^)]+)\)/i', $line, $parts) !== 1) {
            return false;
        }

        $columnNames = $this->partsOf($parts[2]);

        // `PRIMARY KEY ( )` names nothing. It is still a key line, so it is
        // passed over rather than read as a column.
        if ($columnNames === []) {
            return true;
        }

        $keyword = Str::lower(preg_replace('/\s+/', ' ', $parts[1]) ?? '');

        $key = match (true) {
            str_starts_with($keyword, 'primary') => ColumnKeyKind::Primary,
            str_starts_with($keyword, 'unique') => ColumnKeyKind::Unique,
            default => ColumnKeyKind::Index,
        };

        if (count($columnNames) > 1) {
            $skipped[] = __('A :kind on :table spanning several columns was left out: a diagram cannot draw one yet.', [
                'kind' => $key->value,
                'table' => $tableName,
            ]);

            return true;
        }

        $columnName = Str::lower($this->plainName($columnNames[0]));
        $keysByColumn[$columnName][] = $key->value;

        return true;
    }

    /**
     * Read one column.
     *
     * @param  array<int, string>  $skipped
     * @return array<string, mixed>|null
     */
    protected function columnFrom(string $line, string $tableName, array &$skipped): ?array
    {
        if (preg_match('/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|\w+)\s+([a-zA-Z_]+)\s*(?:\(([^)]*)\))?(.*)$/s', $line, $parts) !== 1) {
            return null;
        }

        $columnName = $this->plainName($parts[1]);

        if (! $this->isNameWeCanDraw($columnName)) {
            $skipped[] = __('Column ":name" on :table was left out: the name has characters a diagram cannot carry.', [
                'name' => Str::limit($columnName, 30),
                'table' => $tableName,
            ]);

            return null;
        }

        [$written, $arguments, $rest] = $this->readTypeWords($parts[2], $parts[3] ?? '', $parts[4]);

        $isUnsigned = preg_match('/\bunsigned\b/i', $rest) === 1;
        $type = $this->typeFrom($written, $arguments, $isUnsigned, $rest, $columnName, $tableName, $skipped);

        if ($type === null) {
            return null;
        }

        $keys = [];

        if (preg_match('/\bPRIMARY\s+KEY\b/i', $rest) === 1) {
            $keys[] = ColumnKeyKind::Primary->value;
        }

        if (preg_match('/\bUNIQUE\b/i', $rest) === 1) {
            $keys[] = ColumnKeyKind::Unique->value;
        }

        return [
            'name' => $columnName,
            'type' => $type,
            'isNullable' => preg_match('/\bNOT\s+NULL\b/i', $rest) !== 1
                && preg_match('/\bAUTO_INCREMENT\b/i', $rest) !== 1
                && ! in_array(ColumnKeyKind::Primary->value, $keys, true),
            'keys' => $keys,
            'defaultValue' => $this->defaultFrom($rest, $type, $columnName, $tableName, $skipped),
        ];
    }

    /**
     * Gather a type written as more than one word, and whatever it is measured
     * in.
     *
     * `character varying(255)` and `timestamp with time zone` are one type each,
     * so the words after the first are read before anything decides where the
     * type ends and its modifiers begin.
     *
     * @return array{0: string, 1: string, 2: string} the type, its arguments, and what is left of the line
     */
    protected function readTypeWords(string $written, string $arguments, string $rest): array
    {
        foreach (['varying', 'precision', 'with time zone', 'without time zone'] as $continuation) {
            $pattern = '/^\s*'.preg_quote($continuation, '/').'\b/i';

            if (preg_match($pattern, $rest) === 1) {
                $written .= ' '.$continuation;
                $rest = preg_replace($pattern, '', $rest, 1) ?? $rest;

                break;
            }
        }

        if ($arguments === '' && preg_match('/^\s*\(([^)]*)\)/', $rest, $found) === 1) {
            $arguments = $found[1];
            $rest = substr($rest, strlen($found[0]));
        }

        return [trim($written), $arguments, $rest];
    }

    /**
     * Work out what kind of column this is.
     *
     * @param  array<int, string>  $skipped
     * @return array<string, mixed>|null
     */
    protected function typeFrom(
        string $written,
        string $arguments,
        bool $isUnsigned,
        string $rest,
        string $columnName,
        string $tableName,
        array &$skipped,
    ): ?array {
        $name = Str::lower(trim(preg_replace('/\s+/', ' ', $written) ?? $written));

        if (in_array($name, ['serial', 'bigserial'], true)
            || preg_match('/\bAUTO_INCREMENT\b/i', $rest) === 1) {
            return ['kind' => $columnName === 'id'
                ? ColumnKind::Id->value
                : ColumnKind::BigIncrements->value];
        }

        // `character varying` and `double precision` are two words for one type.
        $name = match ($name) {
            'character varying' => 'varchar',
            'double precision' => 'double',
            'timestamp with time zone' => 'timestamptz',
            'timestamp without time zone' => 'timestamp',
            default => $name,
        };

        $kind = self::TYPE_NAMES[$name] ?? null;

        if ($kind === null) {
            return $this->rawTypeFor($written, $arguments, $columnName, $tableName, $skipped);
        }

        // `tinyint(1)` is how every MySQL dump writes a boolean.
        if ($kind === ColumnKind::TinyInteger->value && trim($arguments) === '1') {
            return ['kind' => ColumnKind::Boolean->value];
        }

        if ($isUnsigned) {
            $kind = self::UNSIGNED_TYPE_NAMES[$kind] ?? $kind;
        }

        return $this->withParameters($kind, $arguments, $columnName, $tableName, $skipped);
    }

    /**
     * Give a type the numbers or values it needs.
     *
     * @param  array<int, string>  $skipped
     * @return array<string, mixed>|null
     */
    protected function withParameters(
        string $kind,
        string $arguments,
        string $columnName,
        string $tableName,
        array &$skipped,
    ): ?array {
        $given = $this->partsOf($arguments);

        return match ($kind) {
            ColumnKind::Char->value => [
                'kind' => $kind,
                'length' => (int) ($given[0] ?? 1) ?: 1,
            ],
            ColumnKind::String->value => [
                'kind' => $kind,
                'length' => (int) ($given[0] ?? 255) ?: 255,
            ],
            ColumnKind::Decimal->value => [
                'kind' => $kind,
                'precision' => (int) ($given[0] ?? 8) ?: 8,
                'scale' => (int) ($given[1] ?? 2),
            ],
            /**
             * A float with nothing in brackets is the 4-byte one. Handing 53 to
             * `float()` would have MySQL store a double instead — wider than
             * the schema being read asked for.
             */
            ColumnKind::Float->value => [
                'kind' => $kind,
                'precision' => (int) ($given[0] ?? 24) ?: 24,
            ],
            ColumnKind::Vector->value => [
                'kind' => $kind,
                'dimensions' => (int) ($given[0] ?? 3) ?: 3,
            ],
            ColumnKind::Enum->value, ColumnKind::Set->value => $this->withAllowedValues($kind, $given, $columnName, $tableName, $skipped),
            default => ['kind' => $kind],
        };
    }

    /**
     * @param  array<int, string>  $given
     * @param  array<int, string>  $skipped
     * @return array<string, mixed>|null
     */
    protected function withAllowedValues(
        string $kind,
        array $given,
        string $columnName,
        string $tableName,
        array &$skipped,
    ): ?array {
        $values = array_map(fn (string $value): string => trim($value, " '\""), $given);

        foreach ($values as $value) {
            if (preg_match(UpdateDiagramDocumentRequest::ENUM_VALUE_PATTERN, $value) !== 1) {
                $skipped[] = __('Column ":name" on :table was left out: one of its allowed values has characters a diagram cannot carry.', [
                    'name' => $columnName,
                    'table' => $tableName,
                ]);

                return null;
            }
        }

        if (count($values) > UpdateDiagramDocumentRequest::MAXIMUM_ENUM_VALUES) {
            $skipped[] = __('Only the first :count allowed values of ":name" in :table were read: a column holds no more than that.', [
                'count' => UpdateDiagramDocumentRequest::MAXIMUM_ENUM_VALUES,
                'name' => $columnName,
                'table' => $tableName,
            ]);

            $values = array_slice($values, 0, UpdateDiagramDocumentRequest::MAXIMUM_ENUM_VALUES);
        }

        return ['kind' => $kind, 'values' => array_values($values)];
    }

    /**
     * Keep a type this tool has no name for, written out as it was found.
     *
     * @param  array<int, string>  $skipped
     * @return array<string, mixed>|null
     */
    protected function rawTypeFor(
        string $written,
        string $arguments,
        string $columnName,
        string $tableName,
        array &$skipped,
    ): ?array {
        $definition = trim($written).($arguments === '' ? '' : "[{$arguments}]");

        if (preg_match(UpdateDiagramDocumentRequest::RAW_DEFINITION_PATTERN, $definition) !== 1) {
            $skipped[] = __('Column ":name" on :table was left out: ":type" is a type a diagram cannot carry.', [
                'name' => $columnName,
                'table' => $tableName,
                'type' => Str::limit($definition, 30),
            ]);

            return null;
        }

        return ['kind' => ColumnKind::Raw->value, 'definition' => $definition];
    }

    /**
     * Read what a column falls back to when a row says nothing about it.
     *
     * @param  array<string, mixed>  $type
     * @param  array<int, string>  $skipped
     * @return array<string, string>
     */
    protected function defaultFrom(
        string $rest,
        array $type,
        string $columnName,
        string $tableName,
        array &$skipped,
    ): array {
        $none = ['kind' => ColumnDefaultKind::None->value];

        if (preg_match("/\bDEFAULT\s+('(?:[^']|'')*'|[^\s,)]+)/i", $rest, $parts) !== 1) {
            return $none;
        }

        $written = trim($parts[1]);

        if (preg_match('/^(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_DATE|LOCALTIMESTAMP)/i', $written) === 1) {
            return ColumnKind::from($type['kind'])->supportsCurrentTimestampDefault()
                ? ['kind' => ColumnDefaultKind::CurrentTimestamp->value]
                : $none;
        }

        if (Str::lower($written) === 'null') {
            return $none;
        }

        $value = str_replace("''", "'", trim($written, "'"));

        if (preg_match(ColumnDefaultKind::VALUE_PATTERN, $value) !== 1) {
            $skipped[] = __('The default on ":name" in :table was left out: it has characters a diagram cannot carry.', [
                'name' => $columnName,
                'table' => $tableName,
            ]);

            return $none;
        }

        return ['kind' => ColumnDefaultKind::Literal->value, 'value' => $value];
    }

    /**
     * Read foreign keys added after the fact, the way a dump writes them.
     *
     * @param  array<int, array<string, string>>  $foreignKeys
     * @param  array<int, string>  $skipped
     */
    protected function readAlterTable(string $statement, array &$foreignKeys, array &$skipped): void
    {
        if (preg_match('/ALTER\s+TABLE\s+([^\s(]+)/i', $statement, $table) !== 1) {
            return;
        }

        preg_match_all(
            '/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i',
            $statement,
            $found,
            PREG_SET_ORDER,
        );

        foreach ($found as $parts) {
            $this->rememberForeignKey(
                $this->plainName($table[1]),
                $parts[1],
                $parts[2],
                $parts[3],
                $foreignKeys,
                $skipped,
            );
        }
    }

    /**
     * @param  array<int, array<string, string>>  $foreignKeys
     * @param  array<int, string>  $skipped
     */
    protected function rememberForeignKey(
        string $tableName,
        string $columnNames,
        string $referencedTable,
        string $referencedColumns,
        array &$foreignKeys,
        array &$skipped,
    ): void {
        $columns = $this->partsOf($columnNames);
        $referenced = $this->partsOf($referencedColumns);

        if ($columns === [] || $referenced === []) {
            return;
        }

        if (count($columns) > 1 || count($referenced) > 1) {
            $skipped[] = __('A relation on :table spanning several columns was left out: a diagram cannot draw one yet.', [
                'table' => $tableName,
            ]);

            return;
        }

        $foreignKeys[] = [
            'table' => $tableName,
            'column' => $this->plainName($columns[0]),
            'referencedTable' => $this->plainName($referencedTable),
            'referencedColumn' => $this->plainName($referenced[0]),
        ];
    }

    /**
     * Keep only the relations whose both ends were read.
     *
     * @param  array<int, array<string, mixed>>  $tables
     * @param  array<int, array<string, string>>  $foreignKeys
     * @param  array<int, string>  $skipped
     * @return array<int, array<string, mixed>>
     */
    protected function relationsAmong(array $tables, array $foreignKeys, array &$skipped): array
    {
        $columnsByTable = [];

        foreach ($tables as $table) {
            $columnsByTable[Str::lower($table['name'])] = array_map(
                fn (array $column): string => Str::lower($column['name']),
                $table['columns'],
            );
        }

        $relations = [];

        foreach ($foreignKeys as $foreignKey) {
            $from = Str::lower($foreignKey['table']);
            $to = Str::lower($foreignKey['referencedTable']);

            $bothEndsExist = in_array(Str::lower($foreignKey['column']), $columnsByTable[$from] ?? [], true)
                && in_array(Str::lower($foreignKey['referencedColumn']), $columnsByTable[$to] ?? [], true);

            if (! $bothEndsExist) {
                $skipped[] = __('A relation from :table was left out: it points at something this SQL does not create.', [
                    'table' => $foreignKey['table'],
                ]);

                continue;
            }

            $relations[] = [
                'from' => ['table' => $foreignKey['table'], 'column' => $foreignKey['column']],
                'to' => ['table' => $foreignKey['referencedTable'], 'column' => $foreignKey['referencedColumn']],
                'isConstrained' => true,
            ];
        }

        return $relations;
    }

    /**
     * Take the quoting off a name, whichever database put it there.
     */
    protected function plainName(string $name): string
    {
        $name = trim(trim($name), "`\"[]' \t\n\r");

        // `pg_dump` writes `public.users`; the schema in front is not the name.
        return Str::afterLast($name, '.');
    }

    /**
     * Can a name be carried by a diagram at all?
     *
     * The rules that guard a saved document are the rules here too: reading a
     * name the canvas would later refuse to save helps nobody.
     */
    protected function isNameWeCanDraw(string $name): bool
    {
        return preg_match(UpdateDiagramDocumentRequest::IDENTIFIER_PATTERN, $name) === 1;
    }
}
