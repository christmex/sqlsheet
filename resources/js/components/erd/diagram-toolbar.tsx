import { Panel, useReactFlow } from '@xyflow/react';
import { Map, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { createStickyNoteNode, createTableNode } from '@/lib/erd';
import type { DiagramNode, RelationEdge } from '@/types';

const newNodeColumnWidthInPixels = 340;
const newNodeRowHeightInPixels = 260;
const newNodesPerRow = 3;

type DiagramToolbarProps = {
    isMinimapVisible: boolean;
    onToggleMinimap: () => void;
};

export default function DiagramToolbar({
    isMinimapVisible,
    onToggleMinimap,
}: DiagramToolbarProps) {
    const { addNodes, getNodes, screenToFlowPosition } = useReactFlow<
        DiagramNode,
        RelationEdge
    >();

    /**
     * Lay new nodes out in a loose grid starting from what the user is looking at.
     *
     * Stepping by a small offset put every new table almost on top of the last one,
     * so the steps are a whole table apart.
     */
    const nextNodePosition = useCallback(
        (existingNodeCount: number) => {
            const start = screenToFlowPosition({
                x: window.innerWidth / 4,
                y: window.innerHeight / 4,
            });

            return {
                x:
                    start.x +
                    (existingNodeCount % newNodesPerRow) *
                        newNodeColumnWidthInPixels,
                y:
                    start.y +
                    Math.floor(existingNodeCount / newNodesPerRow) *
                        newNodeRowHeightInPixels,
            };
        },
        [screenToFlowPosition],
    );

    const addTable = useCallback(() => {
        const takenTableNames = getNodes()
            .filter((node) => node.type === 'table')
            .map((node) => node.data.name);

        addNodes(
            createTableNode(
                nextNodePosition(takenTableNames.length),
                takenTableNames,
            ),
        );
    }, [addNodes, getNodes, nextNodePosition]);

    const addStickyNote = useCallback(() => {
        addNodes(createStickyNoteNode(nextNodePosition(getNodes().length)));
    }, [addNodes, getNodes, nextNodePosition]);

    return (
        <Panel position="top-right">
            <div className="flex gap-2 rounded-lg border border-neutral-200 bg-white/90 p-1.5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={addTable}
                    data-test="add-table"
                >
                    <Plus /> Add table
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={addStickyNote}
                    data-test="add-note"
                >
                    <Plus /> Add note
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    aria-pressed={isMinimapVisible}
                    title={
                        isMinimapVisible
                            ? 'Hide the minimap'
                            : 'Show the minimap'
                    }
                    className={
                        isMinimapVisible ? undefined : 'text-muted-foreground'
                    }
                    onClick={onToggleMinimap}
                    data-test="toggle-minimap"
                >
                    <Map />
                </Button>
            </div>
        </Panel>
    );
}
