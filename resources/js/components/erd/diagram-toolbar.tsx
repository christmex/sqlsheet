import { Panel, useReactFlow } from '@xyflow/react';
import { Keyboard, Layers, Map, Plus, Waypoints } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import ExportImageMenu from '@/components/erd/export-image-menu';
import FindRelationsModal from '@/components/erd/find-relations-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    createStickyNoteNode,
    createTableNode,
    maximumNodesPerDiagram,
    newNodeColumnWidthInPixels,
    newNodeRowHeightInPixels,
    newNodesPerRow,
    nodesFromPreset,
} from '@/lib/erd';
import type { DiagramNode, RelationEdge, TablePreset } from '@/types';

type DiagramToolbarProps = {
    diagramName: string;
    tablePresets: TablePreset[];
    onShowShortcuts: () => void;
    isMinimapVisible: boolean;
    onToggleMinimap: () => void;
};

export default function DiagramToolbar({
    diagramName,
    tablePresets,
    onShowShortcuts,
    isMinimapVisible,
    onToggleMinimap,
}: DiagramToolbarProps) {
    const [isFindingRelations, setIsFindingRelations] = useState(false);
    const { addNodes, addEdges, getEdges, getNodes, screenToFlowPosition } =
        useReactFlow<DiagramNode, RelationEdge>();

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

    const takenTableNamesOnCanvas = useCallback(
        () =>
            getNodes()
                .filter((node) => node.type === 'table')
                .map((node) => node.data.name),
        [getNodes],
    );

    const addTable = useCallback(() => {
        const takenTableNames = takenTableNamesOnCanvas();

        addNodes(
            createTableNode(
                nextNodePosition(takenTableNames.length),
                takenTableNames,
            ),
        );
    }, [addNodes, nextNodePosition, takenTableNamesOnCanvas]);

    const addPreset = useCallback(
        (preset: TablePreset) => {
            const currentNodes = getNodes();
            const tableCount = currentNodes.filter(
                (node) => node.type === 'table',
            ).length;

            const { nodes, edges, skippedTableNames } = nodesFromPreset(
                preset,
                currentNodes,
                getEdges(),
                nextNodePosition(tableCount),
            );

            /**
             * Stop at the ceiling the server enforces. Going past it means every
             * later save is refused, and the only way back is deleting tables by
             * hand with nothing saying how many.
             */
            const room = maximumNodesPerDiagram - getNodes().length;
            const roomForNodes = nodes.slice(0, Math.max(room, 0));

            if (roomForNodes.length > 0) {
                addNodes(roomForNodes);
            }

            // Only the relations whose tables actually made it onto the canvas.
            const addedNodeIds = new Set(roomForNodes.map((node) => node.id));
            const drawableEdges = edges.filter(
                (edge) =>
                    (!nodes.some((node) => node.id === edge.source) ||
                        addedNodeIds.has(edge.source)) &&
                    (!nodes.some((node) => node.id === edge.target) ||
                        addedNodeIds.has(edge.target)),
            );

            if (drawableEdges.length > 0) {
                addEdges(drawableEdges);
            }

            if (roomForNodes.length < nodes.length) {
                toast.warning(
                    `This diagram is full at ${maximumNodesPerDiagram} items, so ${nodes.length - roomForNodes.length} tables were left out.`,
                );
            }

            if (skippedTableNames.length > 0) {
                toast.info(
                    `Already on the canvas, left alone: ${skippedTableNames.join(', ')}`,
                );
            }

            if (preset.caveat) {
                toast.info(preset.caveat);
            }
        },
        [addEdges, addNodes, getEdges, getNodes, nextNodePosition],
    );

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
                {tablePresets.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                variant="ghost"
                                data-test="add-preset"
                            >
                                <Layers /> Preset
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                            {tablePresets.map((preset) => (
                                <DropdownMenuItem
                                    key={preset.key}
                                    className="flex-col items-start gap-0.5"
                                    onSelect={() => addPreset(preset)}
                                    data-test={`add-preset-${preset.key}`}
                                >
                                    <span className="font-medium">
                                        {preset.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {preset.description}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFindingRelations(true)}
                    data-test="find-relations"
                >
                    <Waypoints /> Find relations
                </Button>
                <ExportImageMenu diagramName={diagramName} />
                <Button
                    size="sm"
                    variant="ghost"
                    title="Shortcuts"
                    onClick={onShowShortcuts}
                    data-test="show-shortcuts"
                >
                    <Keyboard />
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

            <FindRelationsModal
                open={isFindingRelations}
                onOpenChange={setIsFindingRelations}
            />
        </Panel>
    );
}
