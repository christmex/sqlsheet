import { Form, Head, Link, usePage } from '@inertiajs/react';
import { MoreVertical, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import DeleteDiagramModal from '@/components/erd/delete-diagram-modal';
import RenameDiagramModal from '@/components/erd/rename-diagram-modal';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { index as diagramsIndex, show, store } from '@/routes/diagrams';
import type { DiagramSummary } from '@/types';

type Props = {
    diagrams: DiagramSummary[];
};

export default function DiagramsIndex({ diagrams }: Props) {
    const { currentTeam } = usePage().props;
    const teamSlug = currentTeam?.slug ?? '';
    const [diagramBeingRenamed, setDiagramBeingRenamed] =
        useState<DiagramSummary | null>(null);
    const [diagramBeingDeleted, setDiagramBeingDeleted] =
        useState<DiagramSummary | null>(null);

    return (
        <>
            <Head title="Diagrams" />

            <div className="flex flex-col space-y-6 p-4">
                <div className="flex items-end justify-between gap-4">
                    <Heading
                        variant="small"
                        title="Diagrams"
                        description="Every database schema you have drawn for this team"
                    />

                    <Form
                        action={store(teamSlug)}
                        resetOnSuccess
                        className="flex items-end gap-2"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div>
                                    <Input
                                        name="name"
                                        placeholder="New diagram name"
                                        className="w-56"
                                        data-test="diagram-name-input"
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    data-test="create-diagram-button"
                                >
                                    <Plus /> New diagram
                                </Button>
                            </>
                        )}
                    </Form>
                </div>

                {diagrams.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No diagrams yet. Name one above to start drawing.
                    </p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {diagrams.map((diagram) => (
                            <li key={diagram.id} className="relative">
                                <Link
                                    href={show({
                                        current_team: teamSlug,
                                        diagram: diagram.id,
                                    })}
                                    className="flex items-center gap-3 rounded-lg border bg-card p-4 pr-12 transition-colors hover:border-neutral-400 hover:bg-accent dark:hover:border-neutral-600"
                                    data-test="diagram-link"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <Table2 className="size-5 text-muted-foreground" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                            {diagram.name}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {diagram.updatedAt
                                                ? `Edited ${new Date(diagram.updatedAt).toLocaleString()}`
                                                : 'Never edited'}
                                        </span>
                                    </span>
                                </Link>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-3 right-2"
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
                            </li>
                        ))}
                    </ul>
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
        </>
    );
}

DiagramsIndex.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        {
            title: 'Diagrams',
            href: props.currentTeam
                ? diagramsIndex(props.currentTeam.slug)
                : '/',
        },
    ],
});
