import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { TableColumn } from '@/types';

/**
 * The columns being carried from one place in the list to another.
 *
 * `offsetY` is how far they have been carried from where they sit, so what is
 * under the cursor is what the cursor is holding — not something that snaps
 * between slots a step behind the hand moving it.
 *
 * `targetRank` counts only the rows staying put, because the rows being carried
 * are dropped into the list of what is left.
 */
type ColumnDrag = {
    columnIds: string[];
    targetRank: number;
    offsetY: number;
    rowHeight: number;
};

type UseColumnReorderOptions = {
    columns: TableColumn[];
    replaceColumns: (columns: TableColumn[]) => void;
    carriedWith: (columnId: string) => string[];
};

/**
 * Carrying columns to a new place in their table, by pointer or by arrow key.
 *
 * Order is what the exporter writes, so this is a real edit rather than a view
 * preference: it goes through the same path as renaming a column and is undone
 * by the same Ctrl+Z.
 */
export function useColumnReorder({
    columns,
    replaceColumns,
    carriedWith,
}: UseColumnReorderOptions) {
    const [columnDrag, setColumnDrag] = useState<ColumnDrag | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    /**
     * Measured once, when the drag starts. Nothing reflows while it runs: the
     * rows only shift by a transform, which leaves the layout they were
     * measured from untouched.
     */
    const stayingSlotCentresRef = useRef<number[]>([]);
    const startYRef = useRef(0);

    /**
     * How far the carried rows may travel before the topmost one leaves the top
     * of the list, or the bottommost one leaves the bottom. Held in screen
     * pixels, because that is what the pointer speaks.
     */
    const limitsRef = useRef({ up: 0, down: 0 });

    /**
     * Put the carried columns down in front of the row at this rank.
     */
    const dropColumns = useCallback(
        (carried: string[], targetRank: number) => {
            const carriedColumns = columns.filter((column) =>
                carried.includes(column.id),
            );
            const staying = columns.filter(
                (column) => !carried.includes(column.id),
            );

            replaceColumns([
                ...staying.slice(0, targetRank),
                ...carriedColumns,
                ...staying.slice(targetRank),
            ]);
        },
        [columns, replaceColumns],
    );

    /**
     * Where in the rows that stay put the carried block would land.
     */
    const rankAt = useCallback(
        (pointerY: number): number =>
            stayingSlotCentresRef.current.filter((centre) => centre < pointerY)
                .length,
        [],
    );

    const beginDrag = useCallback(
        (event: ReactPointerEvent<HTMLElement>, columnId: string) => {
            const carried = carriedWith(columnId);
            const rows = [...(listRef.current?.children ?? [])];
            const isCarriedRow = (index: number) =>
                carried.includes(columns[index]?.id);

            stayingSlotCentresRef.current = rows
                .filter((_, index) => !isCarriedRow(index))
                .map((row) => {
                    const bounds = row.getBoundingClientRect();

                    return bounds.top + bounds.height / 2;
                });

            const listBounds = listRef.current?.getBoundingClientRect();
            const carriedBounds = rows
                .filter((_, index) => isCarriedRow(index))
                .map((row) => row.getBoundingClientRect());

            limitsRef.current = {
                up:
                    (listBounds?.top ?? 0) -
                    Math.min(...carriedBounds.map((bounds) => bounds.top)),
                down:
                    (listBounds?.bottom ?? 0) -
                    Math.max(...carriedBounds.map((bounds) => bounds.bottom)),
            };

            startYRef.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);

            setColumnDrag({
                columnIds: carried,
                targetRank: rankAt(event.clientY),
                offsetY: 0,
                /**
                 * Laid-out pixels, not pixels on screen. The transform is
                 * applied inside the canvas, which the zoom already scales, so
                 * a measurement taken from the screen would be scaled twice.
                 */
                rowHeight:
                    (
                        rows.find((_, index) =>
                            isCarriedRow(index),
                        ) as HTMLElement
                    )?.offsetHeight ?? 0,
            });
        },
        [carriedWith, columns, rankAt],
    );

    const continueDrag = useCallback(
        (event: ReactPointerEvent<HTMLElement>, zoom: number) => {
            setColumnDrag((current) => {
                if (current === null) {
                    return current;
                }

                /**
                 * A row dragged past the end of the list has nowhere to land,
                 * so it is held at the edge rather than floating off the table.
                 * Only the travel is held back — where it lands still comes
                 * from the pointer, which is how the first and last places are
                 * asked for.
                 */
                const { up, down } = limitsRef.current;
                const heldOffsetY = Math.min(
                    Math.max(event.clientY - startYRef.current, up),
                    down,
                );

                return {
                    ...current,
                    offsetY: heldOffsetY / zoom,
                    targetRank: rankAt(event.clientY),
                };
            });
        },
        [rankAt],
    );

    const endDrag = useCallback(() => {
        setColumnDrag((current) => {
            if (current !== null) {
                dropColumns(current.columnIds, current.targetRank);
            }

            return null;
        });
    }, [dropColumns]);

    const cancelDrag = useCallback(() => setColumnDrag(null), []);

    /**
     * Move what is being carried one place up or down, for people not using a
     * pointer. A group moves together, exactly as it would when dragged.
     */
    const moveByStep = useCallback(
        (columnId: string, step: number) => {
            const carried = carriedWith(columnId);
            const staying = columns.filter(
                (column) => !carried.includes(column.id),
            );
            const firstCarriedIndex = columns.findIndex((column) =>
                carried.includes(column.id),
            );
            const rankNow = columns
                .slice(0, firstCarriedIndex)
                .filter((column) => !carried.includes(column.id)).length;

            dropColumns(
                carried,
                Math.min(Math.max(rankNow + step, 0), staying.length),
            );
        },
        [carriedWith, columns, dropColumns],
    );

    const isCarried = useCallback(
        (columnId: string): boolean =>
            columnDrag?.columnIds.includes(columnId) ?? false,
        [columnDrag],
    );

    /**
     * Where a row sits while a drag is running: the carried rows follow the
     * cursor, and the rest open a gap for them to land in.
     */
    const rowStyle = useCallback(
        (columnIndex: number): CSSProperties => {
            if (columnDrag === null) {
                return {};
            }

            if (columnDrag.columnIds.includes(columns[columnIndex].id)) {
                return { transform: `translateY(${columnDrag.offsetY}px)` };
            }

            const rankAmongStaying = columns
                .slice(0, columnIndex)
                .filter(
                    (earlier) => !columnDrag.columnIds.includes(earlier.id),
                ).length;

            const landingIndex =
                rankAmongStaying +
                (rankAmongStaying >= columnDrag.targetRank
                    ? columnDrag.columnIds.length
                    : 0);

            return {
                transform: `translateY(${
                    (landingIndex - columnIndex) * columnDrag.rowHeight
                }px)`,
            };
        },
        [columnDrag, columns],
    );

    return {
        listRef,
        isDragging: columnDrag !== null,
        isCarried,
        rowStyle,
        beginDrag,
        continueDrag,
        endDrag,
        cancelDrag,
        moveByStep,
    };
}
