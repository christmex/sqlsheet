import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import type { ReactNode } from 'react';

/**
 * The columns picked out inside one table.
 *
 * Only one table holds a column selection at a time. Deleting columns from two
 * tables at once would be a single keystroke that changes two schemas, and
 * dragging a group that lives in two tables has no meaning at all: order is a
 * property of one table.
 */
type ColumnSelection = {
    nodeId: string;
    columnIds: string[];
};

type ColumnSelectionValue = {
    selection: ColumnSelection | null;
    isSelected: (nodeId: string, columnId: string) => boolean;
    selectColumn: (
        nodeId: string,
        columnId: string,
        addToSelection: boolean,
    ) => void;
    clearSelection: () => void;
};

const ColumnSelectionContext = createContext<ColumnSelectionValue | null>(null);

export function ColumnSelectionProvider({ children }: { children: ReactNode }) {
    const [selection, setSelection] = useState<ColumnSelection | null>(null);

    const selectColumn = useCallback(
        (nodeId: string, columnId: string, addToSelection: boolean) => {
            setSelection((current) => {
                if (
                    !addToSelection ||
                    current === null ||
                    current.nodeId !== nodeId
                ) {
                    return { nodeId, columnIds: [columnId] };
                }

                const columnIds = current.columnIds.includes(columnId)
                    ? current.columnIds.filter((id) => id !== columnId)
                    : [...current.columnIds, columnId];

                return columnIds.length === 0 ? null : { nodeId, columnIds };
            });
        },
        [],
    );

    const clearSelection = useCallback(() => setSelection(null), []);

    const isSelected = useCallback(
        (nodeId: string, columnId: string) =>
            selection?.nodeId === nodeId &&
            selection.columnIds.includes(columnId),
        [selection],
    );

    const value = useMemo(
        () => ({ selection, isSelected, selectColumn, clearSelection }),
        [clearSelection, isSelected, selectColumn, selection],
    );

    return (
        <ColumnSelectionContext.Provider value={value}>
            {children}
        </ColumnSelectionContext.Provider>
    );
}

export function useColumnSelection(): ColumnSelectionValue {
    const value = useContext(ColumnSelectionContext);

    if (value === null) {
        throw new Error(
            'useColumnSelection has to be used inside a ColumnSelectionProvider.',
        );
    }

    return value;
}
