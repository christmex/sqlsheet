<?php

namespace App\Http\Requests\Diagrams;

use App\Enums\ColumnKeyKind;
use App\Enums\ColumnKind;
use App\Enums\DiagramNodeType;
use App\Enums\RelationCardinality;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validates a whole diagram document before it is stored.
 *
 * The document lives in a single JSON column, so nothing in the database itself can
 * reject a malformed table or a relation pointing at a deleted column. These rules are
 * the only thing standing between the canvas and six months of unusable stored shapes.
 *
 * Every nested key is named on purpose. A key with no rule is a key Laravel hands
 * through to storage untouched, which would let anything at all be parked inside a
 * diagram and wait for whatever reads it next.
 */
class UpdateDiagramDocumentRequest extends FormRequest
{
    /**
     * The most of each thing one diagram may hold.
     *
     * Without a ceiling a single account can grow one row until the disk is full,
     * and every save re-runs the wildcard rules over whatever it grew to.
     */
    public const int MAXIMUM_NODES = 500;

    public const int MAXIMUM_EDGES = 2000;

    public const int MAXIMUM_COLUMNS_PER_TABLE = 200;

    public const int MAXIMUM_ENUM_VALUES = 200;

    public const int MAXIMUM_NOTE_LENGTH = 2000;

    /**
     * Names that can be written into a migration without escaping tricks.
     */
    public const string IDENTIFIER_PATTERN = '/^[A-Za-z0-9_][A-Za-z0-9_ -]{0,63}$/';

    /**
     * A raw type definition.
     *
     * Laravel writes this straight into the CREATE TABLE with no quoting of its
     * own, so brackets are allowed for array types and nothing else that could
     * end one column and begin another.
     */
    public const string RAW_DEFINITION_PATTERN = '/^[A-Za-z0-9_ \[\]]{1,64}$/';

    /**
     * A value inside an enum or set.
     *
     * Laravel quotes these by wrapping them in apostrophes without escaping what
     * is already inside, so an apostrophe here would close the string and leave
     * the rest as SQL.
     */
    public const string ENUM_VALUE_PATTERN = '/^[A-Za-z0-9_ -]{1,64}$/';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'version' => ['required', 'integer', 'min:1'],
            'document' => ['required', 'array'],
            'document.version' => ['required', 'integer', 'in:1'],

            'document.nodes' => ['present', 'array', 'max:'.self::MAXIMUM_NODES],
            'document.nodes.*.id' => ['required', 'string', 'max:64'],
            'document.nodes.*.type' => ['required', Rule::enum(DiagramNodeType::class)],
            'document.nodes.*.position' => ['required', 'array'],
            'document.nodes.*.position.x' => ['required', 'numeric'],
            'document.nodes.*.position.y' => ['required', 'numeric'],
            'document.nodes.*.data' => ['required', 'array'],

            'document.nodes.*.data.name' => ['sometimes', 'string', 'regex:'.self::IDENTIFIER_PATTERN],
            'document.nodes.*.data.headerColor' => ['sometimes', 'string', 'max:32'],
            'document.nodes.*.data.columns' => ['sometimes', 'array', 'max:'.self::MAXIMUM_COLUMNS_PER_TABLE],
            'document.nodes.*.data.columns.*.id' => ['required', 'string', 'max:64'],
            'document.nodes.*.data.columns.*.name' => ['required', 'string', 'regex:'.self::IDENTIFIER_PATTERN],
            'document.nodes.*.data.columns.*.isNullable' => ['required', 'boolean'],
            'document.nodes.*.data.columns.*.defaultValue' => ['present', 'nullable', 'string', 'max:255'],
            'document.nodes.*.data.columns.*.keys' => ['present', 'array', 'max:3'],
            'document.nodes.*.data.columns.*.keys.*' => ['required', Rule::enum(ColumnKeyKind::class)],
            'document.nodes.*.data.columns.*.type' => ['required', 'array'],
            'document.nodes.*.data.columns.*.type.kind' => ['required', Rule::enum(ColumnKind::class)],
            'document.nodes.*.data.columns.*.type.length' => ['sometimes', 'integer', 'min:1', 'max:65535'],
            'document.nodes.*.data.columns.*.type.precision' => ['sometimes', 'integer', 'min:1', 'max:65'],
            'document.nodes.*.data.columns.*.type.scale' => ['sometimes', 'integer', 'min:0', 'max:30'],
            'document.nodes.*.data.columns.*.type.dimensions' => ['sometimes', 'integer', 'min:1', 'max:16000'],
            'document.nodes.*.data.columns.*.type.values' => ['sometimes', 'array', 'max:'.self::MAXIMUM_ENUM_VALUES],
            'document.nodes.*.data.columns.*.type.values.*' => ['required', 'string', 'regex:'.self::ENUM_VALUE_PATTERN],
            'document.nodes.*.data.columns.*.type.definition' => ['sometimes', 'string', 'regex:'.self::RAW_DEFINITION_PATTERN],

            'document.nodes.*.data.text' => ['sometimes', 'string', 'max:'.self::MAXIMUM_NOTE_LENGTH],
            'document.nodes.*.data.color' => ['sometimes', 'string', 'max:32'],

            'document.edges' => ['present', 'array', 'max:'.self::MAXIMUM_EDGES],
            'document.edges.*.id' => ['required', 'string', 'max:64'],
            'document.edges.*.source' => ['required', 'string', 'max:64'],
            'document.edges.*.target' => ['required', 'string', 'max:64'],
            'document.edges.*.sourceHandle' => ['required', 'string', 'max:80'],
            'document.edges.*.targetHandle' => ['required', 'string', 'max:80'],
            'document.edges.*.data' => ['required', 'array'],
            'document.edges.*.data.cardinality' => ['required', Rule::enum(RelationCardinality::class)],
            'document.edges.*.data.foreignKeyEnd' => ['sometimes', Rule::in(['source', 'target'])],
            'document.edges.*.data.isConstrained' => ['sometimes', 'boolean'],

            'document.viewport' => ['required', 'array'],
            'document.viewport.x' => ['required', 'numeric'],
            'document.viewport.y' => ['required', 'numeric'],
            'document.viewport.zoom' => ['required', 'numeric', 'min:0.01', 'max:10'],
        ];
    }

    /**
     * Get the checks that run once the document's shape is known to be sound.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $nodes = $this->input('document.nodes', []);
                $edges = $this->input('document.edges', []);

                $this->ensureEveryNodeCarriesItsOwnShape($validator, $nodes);
                $this->ensureTableNamesAreUnique($validator, $nodes);
                $this->ensureColumnNamesAreUnique($validator, $nodes);
                $this->ensureRelationsPointAtThingsThatExist($validator, $nodes, $edges);
            },
        ];
    }

    /**
     * Reject a node that is missing the fields its own type needs.
     *
     * @param  array<int, array<string, mixed>>  $nodes
     */
    protected function ensureEveryNodeCarriesItsOwnShape(Validator $validator, array $nodes): void
    {
        foreach ($nodes as $nodeIndex => $node) {
            $path = "document.nodes.{$nodeIndex}.data";

            if (($node['type'] ?? null) === DiagramNodeType::Table->value) {
                if (! isset($node['data']['name'])) {
                    $validator->errors()->add("{$path}.name", __('Every table needs a name.'));
                }

                if (! isset($node['data']['columns'])) {
                    $validator->errors()->add("{$path}.columns", __('A table must carry a list of columns.'));
                }

                continue;
            }

            if (! isset($node['data']['text'])) {
                $validator->errors()->add("{$path}.text", __('Every note needs some text.'));
            }
        }
    }

    /**
     * Reject a document where two tables answer to the same name.
     *
     * @param  array<int, array<string, mixed>>  $nodes
     */
    protected function ensureTableNamesAreUnique(Validator $validator, array $nodes): void
    {
        $seenTableNames = [];

        foreach ($this->tableNodes($nodes) as $nodeIndex => $node) {
            $tableName = Str::lower(trim($node['data']['name'] ?? ''));

            if ($tableName === '' || ! isset($seenTableNames[$tableName])) {
                $seenTableNames[$tableName] = true;

                continue;
            }

            $validator->errors()->add(
                "document.nodes.{$nodeIndex}.data.name",
                __('More than one table is named ":name".', ['name' => $tableName]),
            );
        }
    }

    /**
     * Reject a table where two columns answer to the same name.
     *
     * @param  array<int, array<string, mixed>>  $nodes
     */
    protected function ensureColumnNamesAreUnique(Validator $validator, array $nodes): void
    {
        foreach ($this->tableNodes($nodes) as $nodeIndex => $node) {
            $seenColumnNames = [];

            foreach ($node['data']['columns'] ?? [] as $columnIndex => $column) {
                $columnName = Str::lower(trim($column['name'] ?? ''));

                if (! isset($seenColumnNames[$columnName])) {
                    $seenColumnNames[$columnName] = true;

                    continue;
                }

                $validator->errors()->add(
                    "document.nodes.{$nodeIndex}.data.columns.{$columnIndex}.name",
                    __('This table has more than one column named ":name".', ['name' => $columnName]),
                );
            }
        }
    }

    /**
     * Reject relations whose ends no longer resolve to a table and a column in this document.
     *
     * @param  array<int, array<string, mixed>>  $nodes
     * @param  array<int, array<string, mixed>>  $edges
     */
    protected function ensureRelationsPointAtThingsThatExist(Validator $validator, array $nodes, array $edges): void
    {
        $nodeIds = array_flip(array_filter(array_column($nodes, 'id')));

        $columnIds = [];

        foreach ($this->tableNodes($nodes) as $node) {
            foreach ($node['data']['columns'] ?? [] as $column) {
                if (isset($column['id'])) {
                    $columnIds[$column['id']] = true;
                }
            }
        }

        foreach ($edges as $edgeIndex => $edge) {
            foreach (['source' => 'sourceHandle', 'target' => 'targetHandle'] as $nodeKey => $handleKey) {
                if (! isset($nodeIds[$edge[$nodeKey] ?? ''])) {
                    $validator->errors()->add("document.edges.{$edgeIndex}.{$nodeKey}", __('This relation points at a table that is no longer on the canvas.'));
                }

                if (! isset($columnIds[Str::before($edge[$handleKey] ?? '', ':')])) {
                    $validator->errors()->add("document.edges.{$edgeIndex}.{$handleKey}", __('This relation points at a column that no longer exists.'));
                }
            }
        }
    }

    /**
     * Get only the nodes that describe a table, keyed by their position in the document.
     *
     * @param  array<int, array<string, mixed>>  $nodes
     * @return array<int, array<string, mixed>>
     */
    protected function tableNodes(array $nodes): array
    {
        return array_filter(
            $nodes,
            fn (array $node): bool => ($node['type'] ?? null) === DiagramNodeType::Table->value,
        );
    }
}
