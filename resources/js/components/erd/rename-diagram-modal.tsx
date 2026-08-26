import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rename } from '@/routes/diagrams';
import type { DiagramSummary } from '@/types';

type Props = {
    diagram: DiagramSummary;
    teamSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function RenameDiagramModal({
    diagram,
    teamSlug,
    open,
    onOpenChange,
}: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Form
                    {...rename.form({
                        current_team: teamSlug,
                        diagram: diagram.id,
                    })}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Rename diagram</DialogTitle>
                                <DialogDescription>
                                    Only the name changes. Everything drawn on
                                    the canvas stays as it is.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-2">
                                <Label htmlFor="diagram-name">Name</Label>
                                <Input
                                    id="diagram-name"
                                    name="name"
                                    defaultValue={diagram.name}
                                    autoFocus
                                    data-test="rename-diagram-input"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="secondary" type="button">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    data-test="confirm-rename-diagram"
                                >
                                    Save name
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
