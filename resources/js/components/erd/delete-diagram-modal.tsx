import { Form } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { destroy } from '@/routes/diagrams';
import type { DiagramSummary } from '@/types';

type Props = {
    diagram: DiagramSummary;
    teamSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function DeleteDiagramModal({
    diagram,
    teamSlug,
    open,
    onOpenChange,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Form
                    {...destroy.form({
                        current_team: teamSlug,
                        diagram: diagram.id,
                    })}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Delete “{diagram.name}”?
                                </DialogTitle>
                                <DialogDescription>
                                    The diagram and everything drawn on it are
                                    removed for good. This cannot be undone.
                                </DialogDescription>
                            </DialogHeader>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="secondary" type="button">
                                        Keep it
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="destructive"
                                    type="submit"
                                    disabled={processing}
                                    data-test="confirm-delete-diagram"
                                >
                                    Delete diagram
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
