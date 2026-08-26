import type { XYPosition } from '@xyflow/react';
import { nanoid } from 'nanoid';
import type {
    ColumnHandleSide,
    ColumnKeyKind,
    ColumnKind,
    ColumnType,
    DiagramDocument,
    DiagramNode,
    RelationCardinality,
    RelationEdge,
    RelationEnd,
    StoredDiagramNode,
    StoredRelationEdge,
    StoredStickyNoteNode,
    StoredTableNode,
    TableColumn,
} from '@/types/erd';

/**
 * How each type is spelled on the diagram.
 *
 * The familiar SQL spelling is used where there is an unambiguous one, and the
 * Laravel method name everywhere else — guessing a SQL name per database would
 * be inventing a dialect the exporter does not actually target.
 */
const columnTypeLabels: Partial<Record<ColumnKind, string>> = {
    bigInteger: 'bigint',
    integer: 'int',
    smallInteger: 'smallint',
    tinyInteger: 'tinyint',
    mediumInteger: 'mediumint',
    unsignedBigInteger: 'bigint unsigned',
    unsignedInteger: 'int unsigned',
    unsignedSmallInteger: 'smallint unsigned',
    unsignedTinyInteger: 'tinyint unsigned',
    unsignedMediumInteger: 'mediumint unsigned',
    id: 'bigint auto',
    bigIncrements: 'bigint auto',
    increments: 'int auto',
    smallIncrements: 'smallint auto',
    tinyIncrements: 'tinyint auto',
    mediumIncrements: 'mediumint auto',
    boolean: 'boolean',
    text: 'text',
    tinyText: 'tinytext',
    mediumText: 'mediumtext',
    longText: 'longtext',
    json: 'json',
    jsonb: 'jsonb',
    date: 'date',
    dateTime: 'datetime',
    dateTimeTz: 'datetime tz',
    time: 'time',
    timeTz: 'time tz',
    timestamp: 'timestamp',
    timestampTz: 'timestamp tz',
    year: 'year',
    uuid: 'uuid',
    ulid: 'ulid',
    foreignId: 'bigint fk',
    foreignUuid: 'uuid fk',
    foreignUlid: 'ulid fk',
    ipAddress: 'ip',
    macAddress: 'mac',
    binary: 'binary',
};

/**
 * Render a stored column type the way an ERD reader expects to see it.
 */
export function formatColumnType(type: ColumnType): string {
    switch (type.kind) {
        case 'char':
        case 'string':
            return `${type.kind === 'char' ? 'char' : 'varchar'}(${type.length})`;
        case 'float':
        case 'double':
        case 'decimal':
            return `${type.kind}(${type.precision},${type.scale})`;
        case 'enum':
        case 'set':
            return `${type.kind}(${type.values.join(',')})`;
        case 'vector':
            return `vector(${type.dimensions})`;
        case 'raw':
            return type.definition === '' ? 'raw' : type.definition;
        default:
            return columnTypeLabels[type.kind] ?? type.kind;
    }
}

/**
 * Build a type with sensible starting values for the kind that was just picked.
 */
export function defaultColumnTypeFor(kind: ColumnKind): ColumnType {
    switch (kind) {
        case 'char':
            return { kind, length: 36 };
        case 'string':
            return { kind, length: 255 };
        case 'float':
        case 'double':
            return { kind, precision: 8, scale: 2 };
        case 'decimal':
            return { kind, precision: 8, scale: 2 };
        case 'enum':
        case 'set':
            return { kind, values: ['first', 'second'] };
        case 'vector':
            return { kind, dimensions: 3 };
        case 'raw':
            return { kind, definition: '' };
        default:
            return { kind };
    }
}

/**
 * What each type looks like in a Laravel migration.
 *
 * Shown beside every option so the choice is made against the line that will
 * actually be generated, rather than against a name you have to remember.
 */
export const columnKindSignatures: Record<ColumnKind, string> = {
    tinyInteger: "$table->tinyInteger('name')",
    smallInteger: "$table->smallInteger('name')",
    mediumInteger: "$table->mediumInteger('name')",
    integer: "$table->integer('name')",
    bigInteger: "$table->bigInteger('name')",
    unsignedTinyInteger: "$table->unsignedTinyInteger('name')",
    unsignedSmallInteger: "$table->unsignedSmallInteger('name')",
    unsignedMediumInteger: "$table->unsignedMediumInteger('name')",
    unsignedInteger: "$table->unsignedInteger('name')",
    unsignedBigInteger: "$table->unsignedBigInteger('name')",
    id: '$table->id()',
    tinyIncrements: "$table->tinyIncrements('name')",
    smallIncrements: "$table->smallIncrements('name')",
    mediumIncrements: "$table->mediumIncrements('name')",
    increments: "$table->increments('name')",
    bigIncrements: "$table->bigIncrements('name')",
    float: "$table->float('name', 8, 2)",
    double: "$table->double('name', 8, 2)",
    decimal: "$table->decimal('name', 8, 2)",
    char: "$table->char('name', 36)",
    string: "$table->string('name', 255)",
    tinyText: "$table->tinyText('name')",
    text: "$table->text('name')",
    mediumText: "$table->mediumText('name')",
    longText: "$table->longText('name')",
    boolean: "$table->boolean('name')",
    enum: "$table->enum('name', ['a', 'b'])",
    set: "$table->set('name', ['a', 'b'])",
    json: "$table->json('name')",
    jsonb: "$table->jsonb('name')",
    date: "$table->date('name')",
    dateTime: "$table->dateTime('name')",
    dateTimeTz: "$table->dateTimeTz('name')",
    time: "$table->time('name')",
    timeTz: "$table->timeTz('name')",
    timestamp: "$table->timestamp('name')",
    timestampTz: "$table->timestampTz('name')",
    year: "$table->year('name')",
    uuid: "$table->uuid('name')",
    ulid: "$table->ulid('name')",
    foreignId: "$table->foreignId('name')",
    foreignUuid: "$table->foreignUuid('name')",
    foreignUlid: "$table->foreignUlid('name')",
    ipAddress: "$table->ipAddress('name')",
    macAddress: "$table->macAddress('name')",
    binary: "$table->binary('name')",
    geometry: "$table->geometry('name')",
    geography: "$table->geography('name')",
    vector: "$table->vector('name', 3)",
    tsvector: "$table->tsvector('name')",
    raw: "$table->rawColumn('name', 'definition')",
};

export const columnKindGroups: Array<{ label: string; kinds: ColumnKind[] }> = [
    {
        label: 'Integers',
        kinds: [
            'tinyInteger',
            'smallInteger',
            'mediumInteger',
            'integer',
            'bigInteger',
            'unsignedTinyInteger',
            'unsignedSmallInteger',
            'unsignedMediumInteger',
            'unsignedInteger',
            'unsignedBigInteger',
        ],
    },
    {
        label: 'Auto-increment',
        kinds: [
            'id',
            'tinyIncrements',
            'smallIncrements',
            'mediumIncrements',
            'increments',
            'bigIncrements',
        ],
    },
    {
        label: 'Decimals',
        kinds: ['float', 'double', 'decimal'],
    },
    {
        label: 'Strings',
        kinds: ['char', 'string', 'tinyText', 'text', 'mediumText', 'longText'],
    },
    {
        label: 'Choice',
        kinds: ['boolean', 'enum', 'set'],
    },
    {
        label: 'JSON',
        kinds: ['json', 'jsonb'],
    },
    {
        label: 'Dates and times',
        kinds: [
            'date',
            'dateTime',
            'dateTimeTz',
            'time',
            'timeTz',
            'timestamp',
            'timestampTz',
            'year',
        ],
    },
    {
        label: 'Identifiers',
        kinds: ['uuid', 'ulid', 'foreignId', 'foreignUuid', 'foreignUlid'],
    },
    {
        label: 'Network',
        kinds: ['ipAddress', 'macAddress'],
    },
    {
        label: 'Binary and spatial',
        kinds: ['binary', 'geometry', 'geography', 'vector', 'tsvector'],
    },
    {
        label: 'Escape hatch',
        kinds: ['raw'],
    },
];

/**
 * Build the id for the connection point rendered on one side of a column row.
 *
 * React Flow stores `sourceHandle` and `targetHandle` on the edge itself, so
 * encoding the column id here means a relation natively records which columns
 * it joins — nothing has to be mirrored into `edge.data`.
 */
export function columnHandleId(
    columnId: string,
    side: ColumnHandleSide,
): string {
    return `${columnId}:${side}`;
}

export function columnIdFromHandleId(handleId: string): string {
    return handleId.split(':')[0];
}

/**
 * What to draw at the foreign key end of a relation.
 *
 * The other end always reads `1`: it is the row being pointed at. Marking each
 * end separately means the relation cannot be read backwards, however the tables
 * happen to be arranged.
 */
export function foreignKeyEndMarker(cardinality: RelationCardinality): string {
    return cardinality === 'one-to-one' ? '1' : 'N';
}

/**
 * Strip a node down to the fields worth persisting.
 */
export function toStoredNode(node: DiagramNode): StoredDiagramNode {
    const storedNode = {
        id: node.id,
        position: { x: node.position.x, y: node.position.y },
    };

    return node.type === 'stickyNote'
        ? { ...storedNode, type: 'stickyNote', data: node.data }
        : { ...storedNode, type: 'table', data: node.data };
}

/**
 * Strip a relation down to the fields worth persisting.
 */
export function toStoredEdge(edge: RelationEdge): StoredRelationEdge {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? '',
        targetHandle: edge.targetHandle ?? '',
        data: {
            cardinality: edge.data?.cardinality ?? 'one-to-many',
            foreignKeyEnd: edge.data?.foreignKeyEnd ?? 'target',
        },
    };
}

/**
 * Hand a stored relation to the canvas as the edge component that draws itself.
 *
 * The label and the sides it leaves from are worked out at render time, so
 * neither ends up in the document.
 */
export function toCanvasEdge(edge: StoredRelationEdge): RelationEdge {
    return { ...edge, type: 'relation' };
}

/**
 * Serialise a document so two versions of it can be compared by value.
 *
 * Plain `JSON.stringify` is key-order sensitive, and a document that has been
 * through React Flow comes back with its keys in a different order than the
 * server wrote them. Without this, merely opening a diagram looks like an edit
 * and writes a new version — which would put a second tab into a false conflict.
 */
export function canonicalDocumentJson(
    diagramDocument: DiagramDocument,
): string {
    return JSON.stringify(diagramDocument, (_key, value: unknown) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(
                  Object.keys(value as Record<string, unknown>)
                      .sort()
                      .map((key) => [
                          key,
                          (value as Record<string, unknown>)[key],
                      ]),
              )
            : value,
    );
}

export const columnKeyLabels: Record<ColumnKeyKind, string> = {
    primary: 'PK',
    foreign: 'FK',
    unique: 'UQ',
};

export const tableHeaderColors = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#0ea5e9',
    '#a855f7',
];

/**
 * Pick a name that is not taken yet, so adding two things in a row cannot
 * produce a document the server refuses for having duplicate names.
 */
export function nextAvailableName(
    baseName: string,
    takenNames: string[],
): string {
    const taken = new Set(takenNames.map((name) => name.toLowerCase()));

    if (!taken.has(baseName)) {
        return baseName;
    }

    let suffix = 2;

    while (taken.has(`${baseName}_${suffix}`)) {
        suffix += 1;
    }

    return `${baseName}_${suffix}`;
}

export function createTableColumn(takenColumnNames: string[]): TableColumn {
    return {
        id: `col_${nanoid()}`,
        name: nextAvailableName('column', takenColumnNames),
        type: { kind: 'string', length: 255 },
        isNullable: false,
        keys: [],
        defaultValue: null,
    };
}

export function createTableNode(
    position: XYPosition,
    takenTableNames: string[],
): StoredTableNode {
    return {
        id: `tbl_${nanoid()}`,
        type: 'table',
        position,
        data: {
            name: nextAvailableName('new_table', takenTableNames),
            headerColor:
                tableHeaderColors[
                    takenTableNames.length % tableHeaderColors.length
                ],
            columns: [
                {
                    id: `col_${nanoid()}`,
                    name: 'id',
                    type: { kind: 'id' },
                    isNullable: false,
                    keys: ['primary'],
                    defaultValue: null,
                },
            ],
        },
    };
}

export function createStickyNoteNode(
    position: XYPosition,
): StoredStickyNoteNode {
    return {
        id: `note_${nanoid()}`,
        type: 'stickyNote',
        position,
        data: {
            color: '#fef08a',
            text: 'New note',
        },
    };
}

/**
 * The type a foreign key column should take to point at the given column.
 *
 * Laravel has a dedicated method for the common cases — `foreignId` for a column
 * created by `id()`, `foreignUlid` for a `ulid()` — and those carry the right
 * width and signedness with them. Everything else simply copies the type it
 * points at, because a foreign key that is not the same shape as its target
 * cannot hold the value.
 */
export function foreignKeyTypeFor(referencedType: ColumnType): ColumnType {
    switch (referencedType.kind) {
        case 'id':
        case 'bigIncrements':
            return { kind: 'foreignId' };
        case 'increments':
            return { kind: 'unsignedInteger' };
        case 'mediumIncrements':
            return { kind: 'unsignedMediumInteger' };
        case 'smallIncrements':
            return { kind: 'unsignedSmallInteger' };
        case 'tinyIncrements':
            return { kind: 'unsignedTinyInteger' };
        case 'uuid':
            return { kind: 'foreignUuid' };
        case 'ulid':
            return { kind: 'foreignUlid' };
        default:
            return { ...referencedType };
    }
}

/**
 * Turn a table name into the singular Laravel would use for a foreign key.
 *
 * Deliberately simple: it covers the shapes real table names take and leaves
 * anything it does not recognise alone, rather than guessing at irregulars.
 */
export function singularizeTableName(tableName: string): string {
    if (/ies$/i.test(tableName)) {
        return tableName.replace(/ies$/i, 'y');
    }

    if (/(ch|sh|s|x|z)es$/i.test(tableName)) {
        return tableName.replace(/es$/i, '');
    }

    if (/[^s]s$/i.test(tableName)) {
        return tableName.replace(/s$/i, '');
    }

    return tableName;
}

/**
 * The name Laravel would give a foreign key pointing at the referenced column.
 */
export function foreignKeyColumnName(
    referencedTableName: string,
    referencedColumnName: string,
): string {
    return `${singularizeTableName(referencedTableName)}_${referencedColumnName}`;
}

/**
 * Has this column still got the name it was created with?
 *
 * A column the user has already named is never renamed underneath them.
 */
export function hasUntouchedColumnName(columnName: string): boolean {
    return /^column(_\d+)?$/.test(columnName);
}

type RelationColumnEnd = {
    nodeId: string;
    columnId: string;
};

function findColumn(
    nodes: DiagramNode[],
    end: RelationColumnEnd,
): TableColumn | undefined {
    const node = nodes.find(
        (candidate) =>
            candidate.id === end.nodeId && candidate.type === 'table',
    );

    return node?.type === 'table'
        ? node.data.columns.find((column) => column.id === end.columnId)
        : undefined;
}

/**
 * Mark the foreign key side of a new relation and give it the type it points at.
 *
 * Which end is the key is decided by the primary key: the end that is one is
 * being pointed at, so the other end holds the reference. When neither end
 * settles it, the end the line was dropped on is treated as the foreign key.
 */
export function applyRelationToColumns(
    nodes: DiagramNode[],
    source: RelationColumnEnd,
    target: RelationColumnEnd,
): { nodes: DiagramNode[]; foreignKeyEnd: RelationEnd } {
    const sourceColumn = findColumn(nodes, source);
    const targetColumn = findColumn(nodes, target);

    if (!sourceColumn || !targetColumn) {
        return { nodes, foreignKeyEnd: 'target' };
    }

    const findTableNode = (nodeId: string) =>
        nodes.find(
            (candidate) =>
                candidate.id === nodeId && candidate.type === 'table',
        );

    const sourceIsPrimary = sourceColumn.keys.includes('primary');
    const targetIsPrimary = targetColumn.keys.includes('primary');

    const targetHoldsTheKey = sourceIsPrimary || !targetIsPrimary;

    const foreignKeyEnd: RelationEnd = targetHoldsTheKey ? 'target' : 'source';
    const keyEnd = targetHoldsTheKey ? target : source;
    const referencedColumn = targetHoldsTheKey ? sourceColumn : targetColumn;

    const referencedEnd = targetHoldsTheKey ? source : target;
    const referencedNode = findTableNode(referencedEnd.nodeId);

    if (!referencedNode || referencedNode.type !== 'table') {
        return { nodes, foreignKeyEnd };
    }

    const foreignKey: ColumnKeyKind = 'foreign';

    const conventionalName = foreignKeyColumnName(
        referencedNode.data.name,
        referencedColumn.name,
    );

    const updatedNodes = nodes.map((node) => {
        if (node.id !== keyEnd.nodeId || node.type !== 'table') {
            return node;
        }

        const takenNames = node.data.columns
            .filter((column) => column.id !== keyEnd.columnId)
            .map((column) => column.name);

        return {
            ...node,
            data: {
                ...node.data,
                columns: node.data.columns.map((column) =>
                    column.id === keyEnd.columnId
                        ? {
                              ...column,
                              name: hasUntouchedColumnName(column.name)
                                  ? nextAvailableName(
                                        conventionalName,
                                        takenNames,
                                    )
                                  : column.name,
                              keys: column.keys.includes(foreignKey)
                                  ? column.keys
                                  : [...column.keys, foreignKey],
                              type: foreignKeyTypeFor(referencedColumn.type),
                          }
                        : column,
                ),
            },
        };
    });

    return { nodes: updatedNodes, foreignKeyEnd };
}
