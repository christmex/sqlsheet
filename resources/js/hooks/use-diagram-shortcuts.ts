import { useEffect } from 'react';

type UseDiagramShortcutsOptions = {
    onUndo: () => void;
    onRedo: () => void;
    onSelectEverything: () => void;
    onShowShortcuts: () => void;
    onDeletePickedColumns: () => void;
    onSearch: () => void;
    onDismiss: () => void;
};

/**
 * Is the person typing rather than driving the canvas?
 *
 * Undo inside a half-typed table name should undo the typing, not the last
 * thing drawn, and select-all should select the text.
 */
const editableSelector =
    'input, textarea, select, [contenteditable], [role="textbox"], [role="combobox"]';

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable || target.closest(editableSelector) !== null
    );
}

/**
 * Is a dialog in the way?
 *
 * A dialog is a conversation about what to change, not the canvas itself. Undo
 * firing behind an open one can pull the ground out from under the choice being
 * made in it — which is exactly how a relation could be drawn onto a table that
 * had just been undone away.
 */
function isDialogOpen(): boolean {
    return document.querySelector('[role="dialog"]') !== null;
}

/**
 * The keyboard shortcuts the canvas answers to.
 *
 * Both Cmd and Ctrl are accepted rather than sniffing the platform: the wrong
 * guess makes a shortcut silently do nothing, and accepting both costs nothing.
 */
export function useDiagramShortcuts({
    onUndo,
    onRedo,
    onSelectEverything,
    onShowShortcuts,
    onDeletePickedColumns,
    onSearch,
    onDismiss,
}: UseDiagramShortcutsOptions) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isTyping(event.target) || isDialogOpen()) {
                return;
            }

            if (event.key === 'Escape') {
                onDismiss();

                return;
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
                onDeletePickedColumns();

                return;
            }

            if (event.key === '?') {
                event.preventDefault();
                onShowShortcuts();

                return;
            }

            if (!event.metaKey && !event.ctrlKey) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key === 'z') {
                event.preventDefault();
                (event.shiftKey ? onRedo : onUndo)();

                return;
            }

            if (key === 'y') {
                event.preventDefault();
                onRedo();

                return;
            }

            if (key === 'a') {
                event.preventDefault();
                onSelectEverything();

                return;
            }

            if (key === 'f') {
                event.preventDefault();
                onSearch();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [
        onDeletePickedColumns,
        onDismiss,
        onRedo,
        onSearch,
        onSelectEverything,
        onShowShortcuts,
        onUndo,
    ]);
}
