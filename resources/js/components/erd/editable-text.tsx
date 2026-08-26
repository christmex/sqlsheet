import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type EditableTextProps = {
    value: string;
    onCommit: (nextValue: string) => void;
    label: string;
    className?: string;
    inputClassName?: string;
};

/**
 * A piece of text that turns into an input when double-clicked.
 *
 * The input carries React Flow's `nodrag` class and swallows its own key events:
 * without that, typing inside a selected table would drag the node around and
 * Backspace would delete the whole table instead of a character.
 */
export default function EditableText({
    value,
    onCommit,
    label,
    className,
    inputClassName,
}: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.select();
        }
    }, [isEditing]);

    const commit = () => {
        const trimmedDraft = draft.trim();

        setIsEditing(false);

        if (trimmedDraft === '' || trimmedDraft === value) {
            setDraft(value);

            return;
        }

        onCommit(trimmedDraft);
    };

    if (!isEditing) {
        return (
            <span
                className={cn('cursor-text', className)}
                onDoubleClick={() => {
                    setDraft(value);
                    setIsEditing(true);
                }}
                title={label}
            >
                {value}
            </span>
        );
    }

    return (
        <input
            ref={inputRef}
            aria-label={label}
            className={cn(
                'nodrag w-full rounded-sm bg-white px-1 outline-2 outline-neutral-400 dark:bg-neutral-800',
                inputClassName,
            )}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === 'Enter') {
                    commit();
                }

                if (event.key === 'Escape') {
                    setDraft(value);
                    setIsEditing(false);
                }
            }}
        />
    );
}
