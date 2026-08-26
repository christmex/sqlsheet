import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const shortcutGroups = [
    {
        title: 'Changes',
        shortcuts: [
            ['Cmd / Ctrl + Z', 'Undo'],
            ['Cmd / Ctrl + Shift + Z', 'Redo'],
            ['Ctrl + Y', 'Redo, the other way'],
            ['Backspace', 'Delete whatever is selected'],
        ],
    },
    {
        title: 'Selecting',
        shortcuts: [
            ['Cmd / Ctrl + A', 'Select every table, note and relation'],
            ['Drag on empty canvas', 'Draw a selection box'],
            ['Shift + click', 'Add to the selection'],
        ],
    },
    {
        title: 'Moving around',
        shortcuts: [
            ['Two-finger scroll', 'Pan'],
            ['Middle or right drag', 'Pan'],
            ['Pinch, or the + and − buttons', 'Zoom'],
        ],
    },
    {
        title: 'Editing a table',
        shortcuts: [
            ['Double-click a name', 'Rename the table, column or note'],
            ['Click a type', 'Change the type, length and nullability'],
            [
                'Click the key slot on the left',
                'Set primary, foreign or unique',
            ],
            ['Drag between two connection points', 'Draw a relation'],
        ],
    },
];

export default function ShortcutsModal({ open, onOpenChange }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Shortcuts</DialogTitle>
                    <DialogDescription>
                        Press ? at any time to bring this back.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {shortcutGroups.map((group) => (
                        <div key={group.title}>
                            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {group.title}
                            </p>
                            <ul className="space-y-1">
                                {group.shortcuts.map(([keys, meaning]) => (
                                    <li
                                        key={keys}
                                        className="flex items-baseline justify-between gap-4 text-sm"
                                    >
                                        <span className="text-muted-foreground">
                                            {meaning}
                                        </span>
                                        <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                                            {keys}
                                        </kbd>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
