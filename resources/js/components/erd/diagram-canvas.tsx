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
import DiagramToolbar from '@/components/erd/diagram-toolbar';
import RelationEdgeComponent from '@/components/erd/relation-edge';
import ShortcutsModal from '@/components/erd/shortcuts-modal';
import StickyNoteNode from '@/components/erd/sticky-note-node';
import TableNode from '@/components/erd/table-node';
import { useAppearance } from '@/hooks/use-appearance';
import { useDiagramHistory } from '@/hooks/use-diagram-history';
import { useDiagramShortcuts } from '@/hooks/use-diagram-shortcuts';
import {
    applyRelationToColumns,
    columnIdFromHandleId,
    toCanvasEdge,
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

const defaultEdgeOptions: DefaultEdgeOptions = {
    type: 'relation',
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: { strokeWidth: 1.5 },
};

type DiagramCanvasProps = {
    initialDocument: DiagramDocument;
    tablePresets: TablePreset[];
    onDocumentChange?: (nextDocument: DiagramDocument) => void;
    children?: ReactNode;
};

function Canvas({
    initialDocument,
    tablePresets,
    onDocumentChange,
    children,
}: DiagramCanvasProps) {
    const { resolvedAppearance } = useAppearance();
    const [isMinimapVisible, setIsMinimapVisible] = useState(true);
    const [isShowingShortcuts, setIsShowingShortcuts] = useState(false);
    const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(
        initialDocument.nodes,
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

    useDiagramShortcuts({
        onUndo: undo,
        onRedo: redo,
        onSelectEverything: selectEverything,
        onShowShortcuts: () => setIsShowingShortcuts(true),
    });

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

    const onMoveEnd = useCallback(
        (_event: unknown, viewport: Viewport) => {
            viewportRef.current = viewport;
            reportDocument();
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
            colorMode={resolvedAppearance}
            defaultViewport={initialDocument.viewport}
            panOnScroll
            zoomOnScroll={false}
            selectionOnDrag
            panOnDrag={[1, 2]}
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={0.2}
            maxZoom={2}
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
            <ShortcutsModal
                open={isShowingShortcuts}
                onOpenChange={setIsShowingShortcuts}
            />
            <DiagramToolbar
                tablePresets={tablePresets}
                onShowShortcuts={() => setIsShowingShortcuts(true)}
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
            <Canvas {...props} />
        </ReactFlowProvider>
    );
}
