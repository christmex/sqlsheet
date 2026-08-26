import { useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
    DiagramNode,
    StickyNoteNode as StickyNoteNodeType,
} from '@/types';

function StickyNoteNode({ id, data, selected }: NodeProps<StickyNoteNodeType>) {
    const { updateNodeData } = useReactFlow<DiagramNode>();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(data.text);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.select();
        }
    }, [isEditing]);

    const commit = () => {
        setIsEditing(false);

        if (draft.trim() === '') {
            setDraft(data.text);

            return;
        }

        updateNodeData(id, { text: draft });
    };

    return (
        <div
            className={cn(
                'w-56 rounded-md px-3 py-2.5 shadow-md',
                selected && 'ring-2 ring-neutral-900 dark:ring-white',
            )}
            style={{ backgroundColor: data.color }}
        >
            {isEditing ? (
                <textarea
                    ref={inputRef}
                    aria-label="Note text"
                    rows={5}
                    className="nodrag w-full resize-none bg-transparent text-xs leading-relaxed text-neutral-800 outline-none"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === 'Escape') {
                            setDraft(data.text);
                            setIsEditing(false);
                        }
                    }}
                />
            ) : (
                <p
                    className="cursor-text text-xs leading-relaxed whitespace-pre-wrap text-neutral-800"
                    onDoubleClick={() => {
                        setDraft(data.text);
                        setIsEditing(true);
                    }}
                    title="Note text"
                >
                    {data.text}
                </p>
            )}
        </div>
    );
}

export default memo(StickyNoteNode);
