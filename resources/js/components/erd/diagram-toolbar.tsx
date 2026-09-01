import { Panel, useReactFlow } from '@xyflow/react';
import {
    Info,
    Keyboard,
    Layers,
    Map,
    FileCode,
    LayoutGrid,
    Plus,
    Search,
    Waypoints,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import ExportImageMenu from '@/components/erd/export-image-menu';
import FindRelationsModal from '@/components/erd/find-relations-modal';
import ImportSqlModal from '@/components/erd/import-sql-modal';
import ThemeMenu from '@/components/erd/theme-menu';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDiagramSearchActions } from '@/hooks/use-diagram-search';
import {
    arrangeTables,
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
    teamSlug: string;
    diagramId: number;
    onShowShortcuts: () => void;
    isLegendVisible: boolean;
    onToggleLegend: () => void;
    isMinimapVisible: boolean;
    onToggleMinimap: () => void;
};

export default function DiagramToolbar({
    diagramName,
    tablePresets,
    teamSlug,
    diagramId,
    onShowShortcuts,
    isLegendVisible,
    onToggleLegend,
    isMinimapVisible,
    onToggleMinimap,
}: DiagramToolbarProps) {
    const [isFindingRelations, setIsFindingRelations] = useState(false);
    const [isImportingSql, setIsImportingSql] = useState(false);
    const { open: openSearch } = useDiagramSearchActions();
    const {
        addNodes,
        addEdges,
        fitView,
        getEdges,
        getNodes,
        screenToFlowPosition,
        setNodes,
    } = useReactFlow<DiagramNode, RelationEdge>();

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

    /**
     * Start the tidied diagram where the tables already are, so a diagram that
     * was somewhere on the canvas does not jump to the middle of nowhere.
     */
    const tidyStartPosition = (tables: DiagramNode[]) => ({
        x: Math.min(...tables.map((table) => table.position.x)),
        y: Math.min(...tables.map((table) => table.position.y)),
    });

    /**
     * Lay every table out again from what it holds and what it points at.
     *
     * A diagram grown table by table, or read out of a large schema, ends up
     * with tables anywhere. This puts them back in order without touching what
     * any of them says, and one Ctrl+Z takes it back.
     */
    const tidyUp = useCallback(() => {
        const tables = getNodes().filter((node) => node.type === 'table');

        if (tables.length === 0) {
            toast.info('There are no tables to tidy up yet.');

            return;
        }

        const tableIds = new Set(tables.map((table) => table.id));
        const placements = arrangeTables(
            tables.map((table) => ({
                id: table.id,
                columnCount:
                    table.type === 'table' ? table.data.columns.length : 0,
            })),
            getEdges()
                .filter(
                    (edge) =>
                        tableIds.has(edge.source) && tableIds.has(edge.target),
                )
                .map((edge): [string, string] => [edge.source, edge.target]),
            tidyStartPosition(tables),
        );

        setNodes((currentNodes) =>
            currentNodes.map((node) => ({
                ...node,
                position: placements[node.id] ?? node.position,
            })),
        );

        window.requestAnimationFrame(() => fitView({ duration: 400 }));
    }, [fitView, getEdges, getNodes, setNodes]);

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
                <Button
                    size="sm"
                    variant="ghost"
                    title="Lay the tables out again"
                    onClick={tidyUp}
                    data-test="tidy-up"
                >
                    <LayoutGrid /> Tidy up
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsImportingSql(true)}
                    data-test="open-sql-import"
                >
                    <FileCode /> Import SQL
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    title="Find a table or column (Cmd / Ctrl + F)"
                    onClick={openSearch}
                    data-test="open-search"
                >
                    <Search />
                </Button>
                <ExportImageMenu diagramName={diagramName} />
                <ThemeMenu />
                <Button
                    size="sm"
                    variant="ghost"
                    aria-pressed={isLegendVisible}
                    title={
                        isLegendVisible
                            ? 'Hide what the drawing means'
                            : 'Show what the drawing means'
                    }
                    className={
                        isLegendVisible ? undefined : 'text-muted-foreground'
                    }
                    onClick={onToggleLegend}
                    data-test="toggle-legend"
                >
                    <Info />
                </Button>
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

            <ImportSqlModal
                open={isImportingSql}
                onOpenChange={setIsImportingSql}
                teamSlug={teamSlug}
                diagramId={diagramId}
                onRead={addPreset}
            />
        </Panel>
    );
}
