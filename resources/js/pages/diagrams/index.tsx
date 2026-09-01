import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Link2,
    MoreVertical,
    Pencil,
    Plus,
    Star,
    Table2,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import DeleteDiagramModal from '@/components/erd/delete-diagram-modal';
import RenameDiagramModal from '@/components/erd/rename-diagram-modal';
import InputError from '@/components/input-error';
import PendingInvitationsModal from '@/components/pending-invitations-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useOfferedToolbar } from '@/hooks/use-page-toolbar';
import { cn } from '@/lib/utils';
import { show, star, store } from '@/routes/diagrams';
import type { DashboardInvitation, DiagramSummary } from '@/types';

type Props = {
    diagrams: DiagramSummary[];
    pendingInvitations?: DashboardInvitation[];
};

/**
 * Which slice of the list is on show.
 */
const shelves = [
    { key: 'all', label: 'All' },
    { key: 'recent', label: 'Recent' },
    { key: 'starred', label: 'Starred' },
] as const;

type Shelf = (typeof shelves)[number]['key'];

/**
 * The colours a diagram's tile can take.
 *
 * Picked from the diagram's own name rather than stored, so the same schema
 * keeps the same colour every time it is listed and nothing has to be saved to
 * make that true.
 */
const tileColours = [
    'bg-amber-600',
    'bg-blue-600',
    'bg-violet-600',
    'bg-emerald-600',
    'bg-rose-600',
    'bg-sky-600',
];

function tileColourFor(name: string): string {
    const total = [...name].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
    );

    return tileColours[total % tileColours.length];
}

/** How many diagrams count as "recent". */
const recentCount = 6;

export default function DiagramsIndex({
    diagrams,
    pendingInvitations = [],
}: Props) {
    const { currentTeam } = usePage().props;
    const teamSlug = currentTeam?.slug ?? '';
    const [shelf, setShelf] = useState<Shelf>('all');
    const { search, layout } = useOfferedToolbar({
        search: true,
        layout: true,
    });
    const [diagramBeingRenamed, setDiagramBeingRenamed] =
        useState<DiagramSummary | null>(null);
    const [diagramBeingDeleted, setDiagramBeingDeleted] =
        useState<DiagramSummary | null>(null);
    const [showInvitations, setShowInvitations] = useState(
        pendingInvitations.length > 0,
    );

    /** The list arrives newest first, so "recent" is simply the top of it. */
    const shown = useMemo(() => {
        const wanted = search.trim().toLowerCase();
        const matching =
            wanted === ''
                ? diagrams
                : diagrams.filter((diagram) =>
                      diagram.name.toLowerCase().includes(wanted),
                  );

        if (shelf === 'recent') {
            return matching.slice(0, recentCount);
        }

        if (shelf === 'starred') {
            return matching.filter((diagram) => diagram.isStarred);
        }

        return matching;
    }, [diagrams, search, shelf]);

    return (
        <>
            <Head title="Diagrams" />

            <div className="rounded-2xl bg-card/70 p-6 shadow-sm ring-1 ring-border/60 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Diagrams
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Every database schema you have drawn for this team.
                        </p>
                    </div>

                    <Form
                        action={store(teamSlug)}
                        resetOnSuccess
                        className="flex items-start gap-2"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div>
                                    <Input
                                        name="name"
                                        placeholder="New diagram name"
                                        className="h-11 w-56 rounded-xl bg-background"
                                        data-test="diagram-name-input"
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="h-11 rounded-xl px-5"
                                    data-test="create-diagram-button"
                                >
                                    <Plus /> New diagram
                                </Button>
                            </>
                        )}
                    </Form>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                        {shelves.map((candidate) => (
                            <button
                                key={candidate.key}
                                type="button"
                                data-test={`shelf-${candidate.key}`}
                                aria-pressed={shelf === candidate.key}
                                className={cn(
                                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                                    shelf === candidate.key
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground ring-1 ring-border hover:text-foreground',
                                )}
                                onClick={() => setShelf(candidate.key)}
                            >
                                {candidate.label}
                            </button>
                        ))}
                    </div>

                    <p className="text-sm text-muted-foreground">
                        {shown.length}{' '}
                        {shown.length === 1 ? 'diagram' : 'diagrams'}
                    </p>
                </div>

                <ul
                    className={cn(
                        'mt-5 grid gap-4',
                        layout === 'grid' && 'sm:grid-cols-2 xl:grid-cols-3',
                    )}
                >
                    {shown.map((diagram) => (
                        <li
                            key={diagram.id}
                            className="group/card relative rounded-2xl bg-background p-5 ring-1 ring-border/70 transition-shadow hover:shadow-md"
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-xl text-white',
                                        tileColourFor(diagram.name),
                                    )}
                                >
                                    <Table2 className="size-5" />
                                </span>

                                <Link
                                    href={show({
                                        current_team: teamSlug,
                                        diagram: diagram.id,
                                    })}
                                    className="min-w-0 flex-1 pr-14"
                                    data-test="diagram-link"
                                >
                                    <span className="block truncate text-base font-semibold">
                                        {diagram.name}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {diagram.updatedAt
                                            ? `Edited ${new Date(diagram.updatedAt).toLocaleString()}`
                                            : 'Never edited'}
                                    </span>
                                </Link>
                            </div>

                            <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Table2 className="size-3.5" />
                                    {diagram.tables}{' '}
                                    {diagram.tables === 1 ? 'table' : 'tables'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Link2 className="size-3.5" />
                                    {diagram.relations}{' '}
                                    {diagram.relations === 1
                                        ? 'relation'
                                        : 'relations'}
                                </span>
                            </div>

                            <div className="absolute top-4 right-3 flex items-center">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={
                                        diagram.isStarred
                                            ? `Unstar ${diagram.name}`
                                            : `Star ${diagram.name}`
                                    }
                                    aria-pressed={diagram.isStarred}
                                    data-test="star-diagram"
                                    onClick={() =>
                                        router.post(
                                            star({
                                                current_team: teamSlug,
                                                diagram: diagram.id,
                                            }),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    <Star
                                        className={cn(
                                            'size-4',
                                            diagram.isStarred
                                                ? 'fill-amber-400 text-amber-500'
                                                : 'text-muted-foreground',
                                        )}
                                    />
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Actions for ${diagram.name}`}
                                            data-test="diagram-actions"
                                        >
                                            <MoreVertical />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                setDiagramBeingRenamed(diagram)
                                            }
                                            data-test="rename-diagram"
                                        >
                                            <Pencil /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() =>
                                                setDiagramBeingDeleted(diagram)
                                            }
                                            data-test="delete-diagram"
                                        >
                                            <Trash2 /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </li>
                    ))}

                    {shelf === 'all' && search.trim() === '' && (
                        <li>
                            <Form action={store(teamSlug)} resetOnSuccess>
                                {({ processing }) => (
                                    <>
                                        <input
                                            type="hidden"
                                            name="name"
                                            value="Untitled diagram"
                                        />
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            data-test="blank-diagram"
                                            className="flex h-full min-h-[8.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                                        >
                                            <Plus className="size-5" />
                                            Blank diagram
                                        </button>
                                    </>
                                )}
                            </Form>
                        </li>
                    )}
                </ul>

                {shown.length === 0 &&
                    (shelf !== 'all' || search.trim() !== '') && (
                        <p className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                            {search.trim() !== ''
                                ? `Nothing here is called "${search.trim()}".`
                                : shelf === 'starred'
                                  ? 'Nothing starred yet. Press the star on a diagram to keep it here.'
                                  : 'Nothing here yet.'}
                        </p>
                    )}
            </div>

            {diagramBeingRenamed && (
                <RenameDiagramModal
                    diagram={diagramBeingRenamed}
                    teamSlug={teamSlug}
                    open
                    onOpenChange={() => setDiagramBeingRenamed(null)}
                />
            )}

            {diagramBeingDeleted && (
                <DeleteDiagramModal
                    diagram={diagramBeingDeleted}
                    teamSlug={teamSlug}
                    open
                    onOpenChange={() => setDiagramBeingDeleted(null)}
                />
            )}

            <PendingInvitationsModal
                invitations={pendingInvitations}
                open={showInvitations}
                onOpenChange={setShowInvitations}
            />
        </>
    );
}

DiagramsIndex.layout = {
    breadcrumbs: [{ title: 'Diagrams', href: '' }],
};
