import { Head, Link, router, useHttp, usePage } from '@inertiajs/react';
import { Panel } from '@xyflow/react';
import { ArrowLeft, FileCode } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import DiagramCanvas from '@/components/erd/diagram-canvas';
import EditableText from '@/components/erd/editable-text';
import { Button } from '@/components/ui/button';
import { canonicalDocumentJson } from '@/lib/erd';
import { migrations, rename, update } from '@/routes/diagrams';
import { index as diagramsIndex } from '@/routes/diagrams';
import type { DiagramDocument, TablePreset } from '@/types';

const autosaveDelayInMilliseconds = 1000;
const conflictStatus = 409;
const goneStatus = 404;

type Props = {
    hasTables: boolean;
    tablePresets: TablePreset[];
    diagram: {
        id: number;
        name: string;
        document: DiagramDocument;
        version: number;
    };
};

type SavePayload = {
    version: number;
    document: DiagramDocument;
};

type SaveResponse = {
    version: number;
};

type SaveProblem = {
    title: string;
    description: string;
    isPaused: boolean;
};

const conflictProblem: SaveProblem = {
    title: 'This diagram changed somewhere else',
    description:
        'Autosave is paused so your work does not overwrite the newer version. Reload to continue from it.',
    isPaused: true,
};

const refusedProblem: SaveProblem = {
    title: 'This diagram could not be saved',
    description:
        'Autosave is paused. Reload to start again from the last version the server accepted.',
    isPaused: true,
};

/**
 * There is nothing to reload into, so the export is the only way anything on the
 * canvas survives. Telling the user to reload here would send them to a 404.
 */
const deletedProblem: SaveProblem = {
    title: 'This diagram was deleted',
    description:
        'It was removed somewhere else, so nothing more can be saved here. Export the migrations if you still need what is on the canvas.',
    isPaused: true,
};

/**
 * The server refused the document itself, which the user can fix right here —
 * rename the duplicate table, give the column a name. Autosave keeps running so
 * the warning clears itself on the next save that goes through.
 */
function invalidDocumentProblem(reason: string): SaveProblem {
    return {
        title: 'This diagram is not saved yet',
        description: reason,
        isPaused: false,
    };
}

export default function DiagramShow({
    diagram,
    hasTables,
    tablePresets,
}: Props) {
    const [canExport, setCanExport] = useState(hasTables);
    const { currentTeam } = usePage().props;
    const teamSlug = currentTeam?.slug ?? '';

    const updateUrl = update.url({
        current_team: teamSlug,
        diagram: diagram.id,
    });

    const documentRef = useRef<DiagramDocument>(diagram.document);
    const versionRef = useRef<number>(diagram.version);
    const lastSavedDocumentRef = useRef<string>(
        canonicalDocumentJson(diagram.document),
    );
    const autosaveTimerRef = useRef<number | null>(null);
    const isAutosavePausedRef = useRef(false);
    const updateUrlRef = useRef(updateUrl);

    const [saveProblem, setSaveProblem] = useState<SaveProblem | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    const save = useHttp<SavePayload, SaveResponse>({
        version: diagram.version,
        document: diagram.document,
    });

    /**
     * `useHttp` hands back a new object whenever a request starts or finishes, so it
     * is read through a ref. Depending on it directly would rebuild the scheduler on
     * every save, and each save would quietly queue the next one — forever.
     */
    const saveRef = useRef(save);

    useEffect(() => {
        saveRef.current = save;
        updateUrlRef.current = updateUrl;
    }, [save, updateUrl]);

    const pauseAutosave = useCallback((problem: SaveProblem) => {
        isAutosavePausedRef.current = true;
        setSaveProblem(problem);
    }, []);

    const sendDocument = useCallback(() => {
        const documentToSave = canonicalDocumentJson(documentRef.current);

        if (documentToSave === lastSavedDocumentRef.current) {
            return;
        }

        const currentSave = saveRef.current;

        currentSave.transform(() => ({
            version: versionRef.current,
            document: documentRef.current,
        }));

        currentSave
            .patch(updateUrlRef.current, {
                onSuccess: (response) => {
                    versionRef.current = response.version;
                    lastSavedDocumentRef.current = documentToSave;
                    setLastSavedAt(new Date());
                    setSaveProblem(null);
                },
                /**
                 * A rejected document (422) is delivered here and nowhere else —
                 * `onHttpException` is never called for that status.
                 */
                onError: (errors) => {
                    setSaveProblem(
                        invalidDocumentProblem(
                            Object.values(errors)[0] ??
                                'The server would not accept this diagram.',
                        ),
                    );
                },
                /**
                 * Every other refusal arrives here. Returning false keeps Inertia
                 * from stacking a global error dialog on top of the canvas.
                 */
                onHttpException: (response) => {
                    pauseAutosave(
                        {
                            [conflictStatus]: conflictProblem,
                            [goneStatus]: deletedProblem,
                        }[response.status] ?? refusedProblem,
                    );

                    return false;
                },
            })
            // The refusal is already handled above; without this the rejected
            // promise surfaces as an unhandled error in the console.
            .catch(() => undefined);
    }, [pauseAutosave]);

    const scheduleSave = useCallback(
        (nextDocument: DiagramDocument) => {
            documentRef.current = nextDocument;
            setCanExport(
                nextDocument.nodes.some((node) => node.type === 'table'),
            );

            if (isAutosavePausedRef.current) {
                return;
            }

            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
            }

            autosaveTimerRef.current = window.setTimeout(
                sendDocument,
                autosaveDelayInMilliseconds,
            );
        },
        [sendDocument],
    );

    useEffect(
        () => () => {
            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
            }
        },
        [],
    );

    return (
        <>
            <Head title={diagram.name} />

            <div className="h-screen w-screen bg-neutral-50 dark:bg-neutral-950">
                <DiagramCanvas
                    diagramName={diagram.name}
                    initialDocument={diagram.document}
                    tablePresets={tablePresets}
                    onDocumentChange={scheduleSave}
                >
                    <Panel position="top-left">
                        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                data-test="back-to-diagrams"
                            >
                                <Link href={diagramsIndex(teamSlug)}>
                                    <ArrowLeft />
                                </Link>
                            </Button>

                            <div className="mr-1">
                                <EditableText
                                    value={diagram.name}
                                    label="Diagram name"
                                    className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                                    inputClassName="text-sm font-semibold"
                                    onCommit={(name) =>
                                        router.patch(
                                            rename.url({
                                                current_team: teamSlug,
                                                diagram: diagram.id,
                                            }),
                                            { name },
                                            {
                                                preserveScroll: true,
                                                onError: (errors) =>
                                                    toast.error(
                                                        errors.name ??
                                                            'That name was refused.',
                                                    ),
                                            },
                                        )
                                    }
                                />
                                <p
                                    className="text-xs text-neutral-500 dark:text-neutral-400"
                                    data-test="autosave-status"
                                >
                                    {save.processing
                                        ? 'Saving…'
                                        : lastSavedAt
                                          ? `Saved ${lastSavedAt.toLocaleTimeString()}`
                                          : 'Not saved yet'}
                                </p>
                            </div>

                            {canExport && (
                                <Button
                                    asChild
                                    size="sm"
                                    variant="secondary"
                                    data-test="export-migrations"
                                >
                                    <a
                                        href={migrations.url({
                                            current_team: teamSlug,
                                            diagram: diagram.id,
                                        })}
                                    >
                                        <FileCode /> Migrations
                                    </a>
                                </Button>
                            )}
                        </div>
                    </Panel>

                    {saveProblem && (
                        <Panel position="top-center">
                            <div
                                className="max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm shadow-sm dark:border-amber-500/40 dark:bg-amber-950"
                                data-test="conflict-banner"
                            >
                                <p className="font-medium text-amber-900 dark:text-amber-100">
                                    {saveProblem.title}
                                </p>
                                <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">
                                    {saveProblem.description}
                                </p>
                                {saveProblem.isPaused && (
                                    <Button
                                        className="mt-2"
                                        size="sm"
                                        onClick={() => window.location.reload()}
                                        data-test="conflict-reload"
                                    >
                                        Reload
                                    </Button>
                                )}
                            </div>
                        </Panel>
                    )}
                </DiagramCanvas>
            </div>
        </>
    );
}
