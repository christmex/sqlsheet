import {
    addEdge,
    Background,
    BackgroundVariant,
    ConnectionMode,
    Controls,
    MarkerType,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from '@xyflow/react';
import type { DefaultEdgeOptions, OnConnect, Viewport } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import DiagramLegend from '@/components/erd/diagram-legend';
import DiagramToolbar from '@/components/erd/diagram-toolbar';
import RelationEdgeComponent from '@/components/erd/relation-edge';
import SearchBox from '@/components/erd/search-box';
import ShortcutsModal from '@/components/erd/shortcuts-modal';
import StickyNoteNode from '@/components/erd/sticky-note-node';
import TableNode from '@/components/erd/table-node';
import { useAppearance } from '@/hooks/use-appearance';
import {
    ColumnSelectionProvider,
    useColumnSelection,
} from '@/hooks/use-column-selection';
import { useDiagramHistory } from '@/hooks/use-diagram-history';
import {
    DiagramSearchProvider,
    useDiagramSearchActions,
} from '@/hooks/use-diagram-search';
import { useDiagramShortcuts } from '@/hooks/use-diagram-shortcuts';
import {
    applyRelationToColumns,
    columnIdFromHandleId,
    lastColumnNotice,
    maximumZoom,
    minimumZoom,
    toCanvasEdge,
    toCanvasNode,
    toStoredEdge,
    toStoredNode,
} from '@/lib/erd';
import type {
    DiagramDocument,
    DiagramNode,
    RelationEdge,
    TablePreset,
} from '@/types';
import '@xyflow/react/dist/style.css';

const nodeTypes = {
    table: TableNode,
    stickyNote: StickyNoteNode,
};

const edgeTypes = {
    relation: RelationEdgeComponent,
};

/**
 * One grey that reads on both a white canvas and a near-black one.
 *
 * React Flow's own default drops to #3e3e3e in dark mode, which all but vanishes
 * against the background — on screen, and completely in a dark export.
 */
const relationStroke = '#94a3b8';

/**
 * Holding any of these while clicking adds to the selection instead of
 * replacing it.
 *
 * React Flow listens for Cmd on a Mac and Ctrl elsewhere, and neither is what
 * people reach for. Shift is, and it comes at no cost: the three are alternatives
 * rather than a combination.
 */
const multiSelectionKeys = ['Shift', 'Meta', 'Control'];

const defaultEdgeOptions: DefaultEdgeOptions = {
    type: 'relation',
    markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: relationStroke,
    },
    style: { strokeWidth: 1.5, stroke: relationStroke },
};

type DiagramCanvasProps = {
    diagramName: string;
    initialDocument: DiagramDocument;
    tablePresets: TablePreset[];
    onDocumentChange?: (nextDocument: DiagramDocument) => void;
    children?: ReactNode;
};

function Canvas({
    diagramName,
    initialDocument,
    tablePresets,
    onDocumentChange,
    children,
}: DiagramCanvasProps) {
    const { resolvedAppearance } = useAppearance();
    const { selection: columnSelection, clearSelection } = useColumnSelection();
    const { open: openSearch, close: closeSearch } = useDiagramSearchActions();
    const [isMinimapVisible, setIsMinimapVisible] = useState(true);
    const [isShowingShortcuts, setIsShowingShortcuts] = useState(false);
    const [isLegendVisible, setIsLegendVisible] = useState(true);
    const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(
        initialDocument.nodes.map(toCanvasNode),
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdge>(
        initialDocument.edges.map(toCanvasEdge),
    );

    const { undo, redo } = useDiagramHistory({
        nodes,
        edges,
        setNodes,
        setEdges,
    });

    const selectEverything = useCallback(() => {
        setNodes((currentNodes) =>
            currentNodes.map((node) => ({ ...node, selected: true })),
        );
        setEdges((currentEdges) =>
            currentEdges.map((edge) => ({ ...edge, selected: true })),
        );
    }, [setEdges, setNodes]);

    const viewportRef = useRef<Viewport>(initialDocument.viewport);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const hasSeenInitialDocument = useRef(false);

    /**
     * The consumer's callback is reached through a ref on purpose.
     *
     * An autosaving parent rebuilds its handler every time a request starts or
     * finishes. Depending on that identity would make each save schedule the next
     * one, and the canvas would save forever without anybody touching it.
     */
    const documentChangeRef = useRef(onDocumentChange);

    useEffect(() => {
        documentChangeRef.current = onDocumentChange;
    }, [onDocumentChange]);

    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [edges, nodes]);

    const reportDocument = useCallback(() => {
        documentChangeRef.current?.({
            version: 1,
            nodes: nodesRef.current.map(toStoredNode),
            edges: edgesRef.current.map(toStoredEdge),
            viewport: viewportRef.current,
        });
    }, []);

    useEffect(() => {
        if (!hasSeenInitialDocument.current) {
            hasSeenInitialDocument.current = true;

            return;
        }

        reportDocument();
    }, [edges, nodes, reportDocument]);

    /**
     * Take out every column that is picked out, and every relation that ended on
     * one of them. A relation pointing at a column that no longer exists is
     * refused by the server, which would stop the diagram saving until the page
     * is reloaded.
     */
    const removeSelectedColumns = useCallback(() => {
        if (columnSelection === null) {
            return;
        }

        const { nodeId, columnIds } = columnSelection;
        const removed = new Set(columnIds);

        const table = nodesRef.current.find((node) => node.id === nodeId);

        /**
         * A table with no columns is refused when the diagram is saved, and an
         * exported migration that creates nothing would fail on the way in. The
         * table itself is what to delete at that point.
         */
        if (
            table?.type === 'table' &&
            table.data.columns.every((column) => removed.has(column.id))
        ) {
            toast.info(lastColumnNotice);

            return;
        }

        setNodes((currentNodes) =>
            currentNodes.map((node) =>
                node.id === nodeId && node.type === 'table'
                    ? {
                          ...node,
                          data: {
                              ...node.data,
                              columns: node.data.columns.filter(
                                  (column) => !removed.has(column.id),
                              ),
                          },
                      }
                    : node,
            ),
        );

        setEdges((currentEdges) =>
            currentEdges.filter(
                (edge) =>
                    !removed.has(
                        columnIdFromHandleId(edge.sourceHandle ?? ''),
                    ) &&
                    !removed.has(columnIdFromHandleId(edge.targetHandle ?? '')),
            ),
        );

        clearSelection();
    }, [clearSelection, columnSelection, setEdges, setNodes]);

    /**
     * Let go of picked columns once attention has moved elsewhere: their table
     * is gone, or another table has been selected.
     *
     * While columns are picked the delete key belongs to them. Held past the
     * moment it was meant, that key stops answering for anything else — and a
     * selection the person has forgotten about is exactly when they reach for
     * it to delete something they can see.
     */
    useEffect(() => {
        if (columnSelection === null) {
            return;
        }

        const holdingTable = nodes.find(
            (node) => node.id === columnSelection.nodeId,
        );
        const anotherTableIsSelected = nodes.some(
            (node) => node.selected && node.id !== columnSelection.nodeId,
        );

        if (holdingTable === undefined || anotherTableIsSelected) {
            clearSelection();
        }
    }, [clearSelection, columnSelection, nodes]);

    useDiagramShortcuts({
        onUndo: undo,
        onRedo: redo,
        onSelectEverything: selectEverything,
        onShowShortcuts: () => setIsShowingShortcuts(true),
        onDeletePickedColumns: removeSelectedColumns,
        onSearch: openSearch,
        onDismiss: closeSearch,
    });

    const onConnect = useCallback<OnConnect>(
        (connection) => {
            /**
             * Worked out before either update is queued. Reading the result out of
             * one state updater and into another would only be correct while these
             * two hooks stay declared in this order.
             */
            const applied = applyRelationToColumns(
                nodesRef.current,
                {
                    nodeId: connection.source,
                    columnId: columnIdFromHandleId(
                        connection.sourceHandle ?? '',
                    ),
                },
                {
                    nodeId: connection.target,
                    columnId: columnIdFromHandleId(
                        connection.targetHandle ?? '',
                    ),
                },
            );

            setNodes(applied.nodes);

            setEdges((currentEdges) =>
                addEdge<RelationEdge>(
                    {
                        ...connection,
                        id: `rel_${nanoid()}`,
                        type: 'relation',
                        data: {
                            cardinality: 'one-to-many',
                            foreignKeyEnd: applied.foreignKeyEnd,
                            isConstrained: true,
                        },
                    },
                    currentEdges,
                ),
            );
        },
        [setEdges, setNodes],
    );

    /**
     * A move nobody made by hand — stepping the view from one search match to
     * the next — is remembered but not saved. Where someone last looked is
     * worth keeping; a search is not an edit, and should not write to the
     * server on its own.
     */
    const onMoveEnd = useCallback(
        (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
            viewportRef.current = viewport;

            if (event !== null) {
                reportDocument();
            }
        },
        [reportDocument],
    );

    return (
        <ReactFlow<DiagramNode, RelationEdge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onMoveEnd={onMoveEnd}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            multiSelectionKeyCode={multiSelectionKeys}
            /**
             * With columns picked out, the delete key belongs to them. Left to
             * React Flow it would take the whole table instead, which is a much
             * larger thing to lose to one keystroke.
             */
            deleteKeyCode={columnSelection === null ? 'Backspace' : null}
            onPaneClick={clearSelection}
            colorMode={resolvedAppearance}
            defaultViewport={initialDocument.viewport}
            panOnScroll
            zoomOnScroll={false}
            selectionOnDrag
            panOnDrag={[1, 2]}
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={minimumZoom}
            maxZoom={maximumZoom}
        >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} />
            {isMinimapVisible && (
                <MiniMap<DiagramNode>
                    pannable
                    zoomable
                    nodeColor={(node) =>
                        node.type === 'stickyNote'
                            ? node.data.color
                            : node.data.headerColor
                    }
                />
            )}
            <Controls />
            {isLegendVisible && <DiagramLegend />}
            <SearchBox nodes={nodes} />
            <ShortcutsModal
                open={isShowingShortcuts}
                onOpenChange={setIsShowingShortcuts}
            />
            <DiagramToolbar
                diagramName={diagramName}
                tablePresets={tablePresets}
                onShowShortcuts={() => setIsShowingShortcuts(true)}
                isLegendVisible={isLegendVisible}
                onToggleLegend={() => setIsLegendVisible((visible) => !visible)}
                isMinimapVisible={isMinimapVisible}
                onToggleMinimap={() =>
                    setIsMinimapVisible((visible) => !visible)
                }
            />
            {children}
        </ReactFlow>
    );
}

/**
 * React Flow's hooks only work underneath its provider, and this component is
 * the one that renders `<ReactFlow>` — so the provider has to sit above it
 * rather than around the flow itself.
 */
export default function DiagramCanvas(props: DiagramCanvasProps) {
    return (
        <ReactFlowProvider>
            <ColumnSelectionProvider>
                <DiagramSearchProvider>
                    <Canvas {...props} />
                </DiagramSearchProvider>
            </ColumnSelectionProvider>
        </ReactFlowProvider>
    );
}
