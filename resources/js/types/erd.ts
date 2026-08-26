import type { Edge, Node, Viewport } from '@xyflow/react';

export type ColumnKind =
    | 'tinyInteger'
    | 'smallInteger'
    | 'mediumInteger'
    | 'integer'
    | 'bigInteger'
    | 'unsignedTinyInteger'
    | 'unsignedSmallInteger'
    | 'unsignedMediumInteger'
    | 'unsignedInteger'
    | 'unsignedBigInteger'
    | 'id'
    | 'tinyIncrements'
    | 'smallIncrements'
    | 'mediumIncrements'
    | 'increments'
    | 'bigIncrements'
    | 'float'
    | 'double'
    | 'decimal'
    | 'char'
    | 'string'
    | 'tinyText'
    | 'text'
    | 'mediumText'
    | 'longText'
    | 'boolean'
    | 'enum'
    | 'set'
    | 'json'
    | 'jsonb'
    | 'date'
    | 'dateTime'
    | 'dateTimeTz'
    | 'time'
    | 'timeTz'
    | 'timestamp'
    | 'timestampTz'
    | 'year'
    | 'uuid'
    | 'ulid'
    | 'foreignId'
    | 'foreignUuid'
    | 'foreignUlid'
    | 'ipAddress'
    | 'macAddress'
    | 'binary'
    | 'geometry'
    | 'geography'
    | 'vector'
    | 'tsvector'
    | 'raw';

/**
 * A column's data type, stored as structure rather than as free text.
 *
 * Every `kind` maps one-to-one onto a Laravel `Blueprint` method, so the migration
 * exporter builds its output from a lookup table instead of parsing a hand-written
 * type string. `raw` is the escape hatch and maps onto `$table->rawColumn()`.
 */
export type ColumnType =
    | { kind: ParameterlessColumnKind }
    | { kind: 'char' | 'string'; length: number }
    | { kind: 'float' | 'double' | 'decimal'; precision: number; scale: number }
    | { kind: 'enum' | 'set'; values: string[] }
    | { kind: 'vector'; dimensions: number }
    | { kind: 'raw'; definition: string };

export type ParameterlessColumnKind =
    | 'tinyInteger'
    | 'smallInteger'
    | 'mediumInteger'
    | 'integer'
    | 'bigInteger'
    | 'unsignedTinyInteger'
    | 'unsignedSmallInteger'
    | 'unsignedMediumInteger'
    | 'unsignedInteger'
    | 'unsignedBigInteger'
    | 'id'
    | 'tinyIncrements'
    | 'smallIncrements'
    | 'mediumIncrements'
    | 'increments'
    | 'bigIncrements'
    | 'tinyText'
    | 'text'
    | 'mediumText'
    | 'longText'
    | 'boolean'
    | 'json'
    | 'jsonb'
    | 'date'
    | 'dateTime'
    | 'dateTimeTz'
    | 'time'
    | 'timeTz'
    | 'timestamp'
    | 'timestampTz'
    | 'year'
    | 'uuid'
    | 'ulid'
    | 'foreignId'
    | 'foreignUuid'
    | 'foreignUlid'
    | 'ipAddress'
    | 'macAddress'
    | 'binary'
    | 'geometry'
    | 'geography'
    | 'tsvector';

export type ColumnKeyKind = 'primary' | 'foreign' | 'unique';

export type TableColumn = {
    id: string;
    name: string;
    type: ColumnType;
    isNullable: boolean;
    keys: ColumnKeyKind[];
    defaultValue: string | null;
};

export type TableNodeData = {
    name: string;
    headerColor: string;
    columns: TableColumn[];
};

export type StickyNoteNodeData = {
    text: string;
    color: string;
};

/**
 * A physical schema can only express these two.
 *
 * Many-to-many is not a relation a migration can create: it is a pivot table with
 * one of these pointing at it from each side.
 */
export type RelationCardinality = 'one-to-one' | 'one-to-many';

export type RelationEdgeData = {
    cardinality: RelationCardinality;
    /** Which end of the relation carries the foreign key. */
    foreignKeyEnd: RelationEnd;
    /**
     * Is this relation a constraint the database enforces, or only a note that
     * one column points at another?
     *
     * Plenty of real schemas reference a table without ever constraining it —
     * Laravel's own `sessions.user_id` is one — and a diagram that cannot say so
     * forces a choice between drawing the relation and exporting the truth.
     */
    isConstrained: boolean;
};

export type RelationEnd = 'source' | 'target';

export type TableNode = Node<TableNodeData, 'table'>;
export type StickyNoteNode = Node<StickyNoteNodeData, 'stickyNote'>;
export type DiagramNode = TableNode | StickyNoteNode;
export type RelationEdge = Edge<RelationEdgeData>;

export type ColumnHandleSide = 'left' | 'right';

/**
 * What actually gets written to the database.
 *
 * Deliberately not React Flow's own `Node` and `Edge`: those carry runtime state
 * (`selected`, `dragging`, `measured`) and render-only fields typed as React nodes.
 * Persisting them would bloat every save and make merely selecting a table look
 * like a change worth writing.
 */
export type StoredTableNode = {
    id: string;
    type: 'table';
    position: { x: number; y: number };
    data: TableNodeData;
};

export type StoredStickyNoteNode = {
    id: string;
    type: 'stickyNote';
    position: { x: number; y: number };
    data: StickyNoteNodeData;
};

export type StoredDiagramNode = StoredTableNode | StoredStickyNoteNode;

export type StoredRelationEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    data: RelationEdgeData;
};

/**
 * The whole canvas as it is stored in the diagram's single JSON column.
 *
 * `version` describes the shape of this object, not the diagram's save counter —
 * that lives on the diagram row itself and guards against two tabs overwriting
 * each other.
 */
export type DiagramDocument = {
    version: 1;
    nodes: StoredDiagramNode[];
    edges: StoredRelationEdge[];
    viewport: Viewport;
};

export type DiagramSummary = {
    id: number;
    name: string;
    updatedAt: string | null;
};

/**
 * A ready-made set of tables, described by the server and turned into nodes here.
 *
 * Columns arrive without ids: those belong to the diagram the preset is added to,
 * not to the preset itself.
 */
export type TablePreset = {
    key: string;
    name: string;
    description: string;
    caveat: string;
    tables: Array<{
        name: string;
        columns: Array<Omit<TableColumn, 'id'>>;
    }>;
    relations: Array<{
        from: { table: string; column: string };
        to: { table: string; column: string };
        isConstrained: boolean;
    }>;
};

/**
 * A relation the naming convention suggests, before anyone has agreed to it.
 */
export type SuggestedRelation = {
    key: string;
    referencedNodeId: string;
    referencedColumnId: string;
    referencedTableName: string;
    referencedColumnName: string;
    keyNodeId: string;
    keyColumnId: string;
    keyTableName: string;
    keyColumnName: string;
    isSelfReference: boolean;
};
