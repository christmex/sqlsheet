<?php

namespace App\Actions\Diagrams;

use App\Enums\ColumnKeyKind;
use App\Enums\ColumnKind;
use App\Enums\DiagramNodeType;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Turn a stored diagram document into Laravel migration files.
 *
 * This is the reason the column types are stored as structure rather than as
 * typed-in text: every `kind` is already the name of the `Blueprint` method that
 * creates it, so building a migration is a lookup rather than a parse.
 */
class GenerateDiagramMigrations
{
    /**
     * Kinds that create their own auto-incrementing primary key.
     *
     * @var array<int, string>
     */
    protected const AUTO_INCREMENTING_KINDS = [
        ColumnKind::Id->value,
        ColumnKind::Increments->value,
        ColumnKind::TinyIncrements->value,
        ColumnKind::SmallIncrements->value,
        ColumnKind::MediumIncrements->value,
        ColumnKind::BigIncrements->value,
    ];

    /**
     * Kinds that carry their own foreign key constraint through `constrained()`.
     *
     * @var array<int, string>
     */
    protected const SELF_CONSTRAINING_KINDS = [
        ColumnKind::ForeignId->value,
        ColumnKind::ForeignUuid->value,
        ColumnKind::ForeignUlid->value,
    ];

    /**
     * Build one migration file per table, in an order the database will accept.
     *
     * @param  array<string, mixed>  $document
     * @return array<string, string> filename => file contents
     */
    public function handle(array $document, CarbonImmutable $generatedAt): array
    {
        $tables = $this->tablesByNodeId($document);
        $relations = $this->relationsByColumnId($document, $tables);

        $files = [];
        $timestamp = $generatedAt->copy();

        foreach ($this->referencedTablesFirst($tables, $relations) as $table) {
            $tableName = $table['data']['name'];
            $timestamp = $timestamp->addSecond();

            $files[sprintf('%s_create_%s_table.php', $timestamp->format('Y_m_d_His'), Str::snake($tableName))]
                = $this->migrationFor($tableName, $table['data']['columns'] ?? [], $relations);
        }

        return $files;
    }

    /**
     * Get every table node, keyed by its node id.
     *
     * @param  array<string, mixed>  $document
     * @return array<string, array<string, mixed>>
     */
    protected function tablesByNodeId(array $document): array
    {
        $tables = [];

        foreach ($document['nodes'] ?? [] as $node) {
            if (($node['type'] ?? null) === DiagramNodeType::Table->value) {
                $tables[$node['id']] = $node;
            }
        }

        return $tables;
    }

    /**
     * Describe, for every foreign key column, what it points at.
     *
     * @param  array<string, mixed>  $document
     * @param  array<string, array<string, mixed>>  $tables
     * @return array<string, array{table: string, column: string, tableNodeId: string, isConstrained: bool}>
     */
    protected function relationsByColumnId(array $document, array $tables): array
    {
        $columnOwners = [];

        foreach ($tables as $nodeId => $table) {
            foreach ($table['data']['columns'] ?? [] as $column) {
                $columnOwners[$column['id']] = ['nodeId' => $nodeId, 'column' => $column];
            }
        }

        $relations = [];

        foreach ($document['edges'] ?? [] as $edge) {
            $keyEnd = ($edge['data']['foreignKeyEnd'] ?? 'target') === 'source' ? 'source' : 'target';
            $referencedEnd = $keyEnd === 'target' ? 'source' : 'target';

            $keyColumnId = Str::before($edge[$keyEnd.'Handle'] ?? '', ':');
            $referencedColumnId = Str::before($edge[$referencedEnd.'Handle'] ?? '', ':');

            if (! isset($columnOwners[$keyColumnId], $columnOwners[$referencedColumnId])) {
                continue;
            }

            $referencedOwner = $columnOwners[$referencedColumnId];

            $relations[$keyColumnId] = [
                'table' => $tables[$referencedOwner['nodeId']]['data']['name'],
                'column' => $referencedOwner['column']['name'],
                'tableNodeId' => $referencedOwner['nodeId'],
                'isConstrained' => (bool) ($edge['data']['isConstrained'] ?? true),
            ];
        }

        return $relations;
    }

    /**
     * Order tables so that a table is created after everything it points at.
     *
     * Tables caught in a cycle keep their original order: the database cannot
     * accept mutual foreign keys in one pass either way, and silently dropping
     * them would hide the problem instead of showing it.
     *
     * @param  array<string, array<string, mixed>>  $tables
     * @param  array<string, array{table: string, column: string, tableNodeId: string, isConstrained: bool}>  $relations
     * @return array<int, array<string, mixed>>
     */
    protected function referencedTablesFirst(array $tables, array $relations): array
    {
        $dependencies = [];

        foreach ($tables as $nodeId => $table) {
            $dependencies[$nodeId] = [];

            foreach ($table['data']['columns'] ?? [] as $column) {
                $relation = $relations[$column['id']] ?? null;
                $referenced = $relation !== null && $relation['isConstrained']
                    ? $relation['tableNodeId']
                    : null;

                if ($referenced !== null && $referenced !== $nodeId) {
                    $dependencies[$nodeId][$referenced] = true;
                }
            }
        }

        $ordered = [];
        $placed = [];

        while (count($placed) < count($tables)) {
            $placedThisPass = false;

            foreach ($tables as $nodeId => $table) {
                if (isset($placed[$nodeId])) {
                    continue;
                }

                if (array_diff_key($dependencies[$nodeId], $placed) !== []) {
                    continue;
                }

                $ordered[] = $table;
                $placed[$nodeId] = true;
                $placedThisPass = true;
            }

            if (! $placedThisPass) {
                /**
                 * Release one table that is genuinely part of a cycle, not merely the
                 * first one queued behind it. Everything else still has an order the
                 * database can accept, and freeing the wrong table would throw that away.
                 */
                $releasedNodeId = $this->tableOnACycle($dependencies, $placed);

                $ordered[] = $tables[$releasedNodeId];
                $placed[$releasedNodeId] = true;
            }
        }

        return $ordered;
    }

    /**
     * Find a table that takes part in a cycle of foreign keys.
     *
     * Walks the dependencies of each unplaced table; the first table met twice on
     * one walk is on the cycle itself.
     *
     * @param  array<string, array<string, bool>>  $dependencies
     * @param  array<string, bool>  $placed
     */
    protected function tableOnACycle(array $dependencies, array $placed): string
    {
        foreach (array_keys($dependencies) as $startNodeId) {
            if (isset($placed[$startNodeId])) {
                continue;
            }

            $walk = [$startNodeId];
            $onThisWalk = [$startNodeId => true];

            while ($walk !== []) {
                $nodeId = array_pop($walk);

                foreach (array_keys($dependencies[$nodeId] ?? []) as $dependencyId) {
                    if (isset($placed[$dependencyId])) {
                        continue;
                    }

                    if (isset($onThisWalk[$dependencyId])) {
                        return $dependencyId;
                    }

                    $onThisWalk[$dependencyId] = true;
                    $walk[] = $dependencyId;
                }
            }
        }

        return (string) array_key_first(array_diff_key($dependencies, $placed));
    }

    /**
     * Build the whole migration file for one table.
     *
     * @param  array<int, array<string, mixed>>  $columns
     * @param  array<string, array{table: string, column: string, tableNodeId: string, isConstrained: bool}>  $relations
     */
    protected function migrationFor(string $tableName, array $columns, array $relations): string
    {
        $lines = [];

        foreach ($columns as $column) {
            $lines[] = '            '.$this->columnLine($column, $relations[$column['id']] ?? null);
        }

        foreach ($columns as $column) {
            $relation = $relations[$column['id']] ?? null;

            if ($relation === null
                || ! $relation['isConstrained']
                || in_array($column['type']['kind'], self::SELF_CONSTRAINING_KINDS, true)
            ) {
                continue;
            }

            $lines[] = sprintf(
                '            $table->foreign(%s)->references(%s)->on(%s);',
                var_export($column['name'], true),
                var_export($relation['column'], true),
                var_export($relation['table'], true),
            );
        }

        $body = implode("\n", $lines);

        return <<<PHP
        <?php

        use Illuminate\\Database\\Migrations\\Migration;
        use Illuminate\\Database\\Schema\\Blueprint;
        use Illuminate\\Support\\Facades\\Schema;

        return new class extends Migration
        {
            /**
             * Run the migrations.
             */
            public function up(): void
            {
                Schema::create({$this->quoted($tableName)}, function (Blueprint \$table) {
        {$body}
                });
            }

            /**
             * Reverse the migrations.
             */
            public function down(): void
            {
                Schema::dropIfExists({$this->quoted($tableName)});
            }
        };

        PHP;
    }

    /**
     * Build the single line that creates one column.
     *
     * @param  array<string, mixed>  $column
     * @param  array{table: string, column: string, tableNodeId: string, isConstrained: bool}|null  $relation
     */
    protected function columnLine(array $column, ?array $relation): string
    {
        $kind = $column['type']['kind'];
        $method = $kind === ColumnKind::Raw->value ? 'rawColumn' : $kind;

        $line = sprintf('$table->%s(%s)', $method, implode(', ', $this->arguments($column)));

        /**
         * Every modifier has to be chained before `constrained()`. That call returns
         * the foreign key definition rather than the column, so anything added after
         * it is recorded against the constraint and the column is built without it —
         * a nullable foreign key would come out NOT NULL.
         */
        if ($column['isNullable'] ?? false) {
            $line .= '->nullable()';
        }

        if (in_array(ColumnKeyKind::Unique->value, $column['keys'] ?? [], true)) {
            $line .= '->unique()';
        }

        if (in_array(ColumnKeyKind::Primary->value, $column['keys'] ?? [], true)
            && ! in_array($kind, self::AUTO_INCREMENTING_KINDS, true)) {
            $line .= '->primary()';
        }

        if (($column['defaultValue'] ?? null) !== null) {
            $line .= sprintf('->default(%s)', $this->quoted($column['defaultValue']));
        }

        if ($relation !== null && $relation['isConstrained'] && in_array($kind, self::SELF_CONSTRAINING_KINDS, true)) {
            $line .= sprintf('->constrained(%s)', $this->quoted($relation['table']));
        }

        return $line.';';
    }

    /**
     * Build the arguments the column's own method takes.
     *
     * @param  array<string, mixed>  $column
     * @return array<int, string>
     */
    protected function arguments(array $column): array
    {
        $type = $column['type'];
        $name = $this->quoted($column['name']);

        // `id()` already names itself; passing 'id' back would only add noise.
        if ($type['kind'] === ColumnKind::Id->value) {
            return $column['name'] === 'id' ? [] : [$name];
        }

        return match ($type['kind']) {
            ColumnKind::Char->value => [$name, (string) ($type['length'] ?? 36)],
            ColumnKind::String->value => [$name, (string) ($type['length'] ?? 255)],
            ColumnKind::Decimal->value => [
                $name,
                (string) ($type['precision'] ?? 8),
                (string) ($type['scale'] ?? 2),
            ],
            // `float($column, $precision)` takes no scale, and `double($column)` takes neither.
            ColumnKind::Float->value => [$name, (string) ($type['precision'] ?? 53)],
            ColumnKind::Double->value => [$name],
            ColumnKind::Enum->value, ColumnKind::Set->value => [
                $name,
                '['.implode(', ', array_map($this->quoted(...), $type['values'] ?? [])).']',
            ],
            ColumnKind::Vector->value => [$name, (string) ($type['dimensions'] ?? 3)],
            ColumnKind::Raw->value => [$name, $this->quoted($type['definition'] ?? '')],
            default => [$name],
        };
    }

    /**
     * Write a value as PHP source.
     *
     * Names and raw definitions are already restricted to a safe character set
     * when the document is saved; exporting through `var_export` means the file
     * stays correct even if that set is ever widened.
     */
    protected function quoted(string $value): string
    {
        return var_export($value, true);
    }
}
