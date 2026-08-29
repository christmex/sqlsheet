import {
    Handle,
    Position,
    useReactFlow,
    useUpdateNodeInternals,
} from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { GripVertical, Plus, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import ColumnEditor from '@/components/erd/column-editor';
import EditableText from '@/components/erd/editable-text';
import { useColumnReorder } from '@/hooks/use-column-reorder';
import { useColumnSelection } from '@/hooks/use-column-selection';
import {
    columnHandleId,
    columnKeyLabels,
    columnIdFromHandleId,
    lastColumnNotice,
    createTableColumn,
} from '@/lib/erd';
import { cn } from '@/lib/utils';
import type {
    ColumnKeyKind,
    DiagramNode,
    RelationEdge,
    TableColumn,
    TableNode as TableNodeType,
} from '@/types';

const keyStyles: Record<ColumnKeyKind, string> = {
    primary:
        'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    foreign: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    unique: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
    index: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700/40 dark:text-neutral-300',
};

/**
 * Always shown, dimmed until the table is hovered.
 *
 * Hidden entirely, a table reads as finished: nothing says a relation can start
 * here. At full strength on every row of every table, a large diagram turns into
 * a field of dots.
 */
const handleStyles =
    'size-2.5! rounded-full! border-2! border-white! bg-neutral-300! opacity-70 transition-opacity duration-150 group-hover/table:bg-neutral-400! group-hover/table:opacity-100 dark:border-neutral-900! dark:bg-neutral-600!';

function TableNode({ id, data, selected }: NodeProps<TableNodeType>) {
    const { updateNodeData, setEdges, getZoom } = useReactFlow<
        DiagramNode,
        RelationEdge
    >();
    const updateNodeInternals = useUpdateNodeInternals();
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const { isSelected, selectColumn } = useColumnSelection();

    const replaceColumns = useCallback(
        (columns: TableColumn[]) => {
            updateNodeData(id, { columns });
            updateNodeInternals(id);
        },
        [id, updateNodeData, updateNodeInternals],
    );

    const editColumn = useCallback(
        (columnId: string, changes: Partial<TableColumn>) => {
            updateNodeData(id, {
                columns: data.columns.map((column) =>
                    column.id === columnId ? { ...column, ...changes } : column,
                ),
            });
        },
        [data.columns, id, updateNodeData],
    );

    const addColumn = useCallback(() => {
        replaceColumns([
            ...data.columns,
            createTableColumn(data.columns.map((column) => column.name)),
        ]);
    }, [data.columns, replaceColumns]);

    /**
     * Removing a column also removes every relation that ends on it. A relation
     * left pointing at a column that no longer exists is rejected by the server,
     * which would pause autosave until the page is reloaded.
     */
    const removeColumn = useCallback(
        (columnId: string) => {
            if (data.columns.length === 1) {
                toast.info(lastColumnNotice);

                return;
            }

            replaceColumns(
                data.columns.filter((column) => column.id !== columnId),
            );

            setEdges((currentEdges) =>
                currentEdges.filter(
                    (edge) =>
                        columnIdFromHandleId(edge.sourceHandle ?? '') !==
                            columnId &&
                        columnIdFromHandleId(edge.targetHandle ?? '') !==
                            columnId,
                ),
            );
        },
        [data.columns, replaceColumns, setEdges],
    );

    /**
     * Grabbing a row that is picked out carries the whole selection; grabbing
     * any other row carries only that row.
     */
    const carriedWith = useCallback(
        (columnId: string): string[] =>
            isSelected(id, columnId)
                ? data.columns
                      .filter((candidate) => isSelected(id, candidate.id))
                      .map((candidate) => candidate.id)
                : [columnId],
        [data.columns, id, isSelected],
    );

    const {
        listRef,
        isDragging,
        isCarried,
        rowStyle,
        beginDrag,
        continueDrag,
        endDrag,
        cancelDrag,
        moveByStep,
    } = useColumnReorder({
        columns: data.columns,
        replaceColumns,
        carriedWith,
    });

    return (
        <div
            className={cn(
                'group/table w-72 rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow dark:border-neutral-800 dark:bg-neutral-900',
                selected && 'shadow-lg ring-2 ring-neutral-900 dark:ring-white',
            )}
        >
            <div
                className="rounded-t-[7px] px-3 py-2"
                style={{ backgroundColor: data.headerColor }}
            >
                <EditableText
                    value={data.name}
                    label="Table name"
                    className="block truncate text-sm font-semibold text-white"
                    inputClassName="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                    onCommit={(name) => updateNodeData(id, { name })}
                />
            </div>

            <div
                ref={listRef}
                className="divide-y divide-neutral-100 dark:divide-neutral-800"
            >
                {data.columns.map((column, columnIndex) => {
                    const isBeingCarried = isCarried(column.id);
                    const isPickedOut = isSelected(id, column.id);

                    return (
                        <div
                            key={column.id}
                            data-test="column-row"
                            className={cn(
                                'group/row relative flex items-center gap-2 px-3 py-1.5',
                                isPickedOut &&
                                    'bg-sky-50/80 dark:bg-sky-400/10',
                                isBeingCarried
                                    ? 'z-10 rounded-md bg-white shadow-lg ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-600'
                                    : isDragging &&
                                          'transition-transform duration-150',
                            )}
                            style={rowStyle(columnIndex)}
                            onPointerDown={(event) => {
                                /**
                                 * A control on the row speaks for itself; only a
                                 * press on the row's own space picks it out.
                                 */
                                if (
                                    (event.target as HTMLElement).closest(
                                        'button, input',
                                    ) !== null
                                ) {
                                    return;
                                }

                                selectColumn(id, column.id, event.shiftKey);
                            }}
                            onClick={(event) => {
                                /**
                                 * A row covers most of a table, so a click meant
                                 * for a column would otherwise also land on the
                                 * table and select it. Only the press is stopped;
                                 * dragging a table by one of its rows still works.
                                 */
                                if (
                                    (event.target as HTMLElement).closest(
                                        'button, input',
                                    ) === null
                                ) {
                                    event.stopPropagation();
                                }
                            }}
                        >
                            <Handle
                                type="source"
                                id={columnHandleId(column.id, 'left')}
                                position={Position.Left}
                                className={handleStyles}
                            />

                            <button
                                type="button"
                                aria-label={`Reorder ${column.name}`}
                                data-test="reorder-column"
                                title="Drag to reorder, or use the arrow keys"
                                className={cn(
                                    'nodrag -ml-2 shrink-0 touch-none rounded text-neutral-300 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 dark:text-neutral-600',
                                    isBeingCarried
                                        ? 'cursor-grabbing opacity-100'
                                        : 'cursor-grab',
                                )}
                                onPointerDown={(event) =>
                                    beginDrag(event, column.id)
                                }
                                onPointerMove={(event) =>
                                    isBeingCarried &&
                                    continueDrag(event, getZoom())
                                }
                                onPointerUp={endDrag}
                                onPointerCancel={cancelDrag}
                                onKeyDown={(event) => {
                                    const step =
                                        event.key === 'ArrowUp'
                                            ? -1
                                            : event.key === 'ArrowDown'
                                              ? 1
                                              : 0;

                                    if (step === 0) {
                                        return;
                                    }

                                    /**
                                     * The canvas moves the selected table with
                                     * the same keys, and would move it out from
                                     * under the column being reordered.
                                     */
                                    event.preventDefault();
                                    event.stopPropagation();

                                    moveByStep(column.id, step);
                                }}
                            >
                                <GripVertical className="size-3" />
                            </button>

                            <button
                                type="button"
                                aria-label={`Keys on ${column.name}`}
                                data-test="column-keys"
                                title="Keys and indexes on this column"
                                className="nodrag flex w-14 shrink-0 cursor-pointer gap-1"
                                onClick={() => setEditingColumnId(column.id)}
                            >
                                {column.keys.length === 0 ? (
                                    <span className="text-[9px] leading-4 text-neutral-200 transition-colors group-hover/row:text-neutral-400 dark:text-neutral-700 dark:group-hover/row:text-neutral-500">
                                        key
                                    </span>
                                ) : (
                                    column.keys.map((key) => (
                                        <span
                                            key={key}
                                            className={cn(
                                                'rounded px-1 text-[9px] leading-4 font-bold',
                                                keyStyles[key],
                                            )}
                                        >
                                            {columnKeyLabels[key]}
                                        </span>
                                    ))
                                )}
                            </button>

                            <EditableText
                                value={column.name}
                                label="Column name"
                                className="min-w-0 flex-1 truncate text-xs text-neutral-800 dark:text-neutral-100"
                                inputClassName="text-xs"
                                onCommit={(name) =>
                                    editColumn(column.id, { name })
                                }
                            />

                            <ColumnEditor
                                column={column}
                                isOpen={editingColumnId === column.id}
                                onOpen={() => setEditingColumnId(column.id)}
                                onClose={() => setEditingColumnId(null)}
                                onChange={(changes) =>
                                    editColumn(column.id, changes)
                                }
                            />

                            <button
                                type="button"
                                aria-label={`Remove ${column.name}`}
                                data-test="remove-column"
                                className="nodrag shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                                onClick={() => removeColumn(column.id)}
                            >
                                <X className="size-3" />
                            </button>

                            <Handle
                                type="source"
                                id={columnHandleId(column.id, 'right')}
                                position={Position.Right}
                                className={handleStyles}
                            />
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                data-test="add-column"
                className="nodrag flex w-full items-center gap-1 rounded-b-[7px] border-t border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                onClick={addColumn}
            >
                <Plus className="size-3" /> Add column
            </button>
        </div>
    );
}

export default memo(TableNode);
