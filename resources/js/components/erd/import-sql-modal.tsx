import { useHttp } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { maximumSqlLength } from '@/lib/erd';
import { cn } from '@/lib/utils';
import { importSql } from '@/routes/diagrams';
import type { TablePreset } from '@/types';

type ImportSqlModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamSlug: string;
    diagramId: number;
    onRead: (preset: TablePreset) => void;
};

/**
 * What the server made of the pasted SQL.
 */
type SqlReading = {
    tables: TablePreset['tables'];
    relations: TablePreset['relations'];
    /** The parts of the schema a diagram cannot carry, said plainly. */
    skipped: string[];
};

/**
 * Read a schema out of pasted SQL.
 *
 * The reading happens on the server, where the type model and its rules already
 * live, and comes back shaped like a preset — so what lands on the canvas
 * arrives through the same door as the built-in table packs, and is undone the
 * same way.
 */
export default function ImportSqlModal({
    open,
    onOpenChange,
    teamSlug,
    diagramId,
    onRead,
}: ImportSqlModalProps) {
    const [sql, setSql] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const read = useHttp<{ sql: string }, SqlReading>({ sql: '' });

    const close = () => {
        setSql('');
        setFileName(null);
        onOpenChange(false);
    };

    /**
     * Read a chosen file here in the browser and keep only its text.
     *
     * Nothing is uploaded: the server is sent the same text a paste would send,
     * so there is no file to store and none is stored.
     */
    const readFile = async (file: File | undefined) => {
        if (file === undefined) {
            return;
        }

        if (file.size > maximumSqlLength) {
            toast.error(
                `${file.name} is larger than this can read. Export the schema on its own — mysqldump --no-data, or pg_dump --schema-only.`,
            );

            return;
        }

        setSql(await file.text());
        setFileName(file.name);
    };

    const readTheSql = () => {
        // `transform` hands nothing back, so the request is made on its own line.
        read.transform(() => ({ sql }));

        read.post(
            importSql.url({ current_team: teamSlug, diagram: diagramId }),
            {
                onSuccess: (reading: SqlReading) => {
                    if (reading.tables.length === 0) {
                        toast.warning(
                            'No CREATE TABLE statements were found in that.',
                        );

                        return;
                    }

                    onRead({
                        key: 'imported-sql',
                        name: 'Imported SQL',
                        description: '',
                        caveat: '',
                        tables: reading.tables,
                        relations: reading.relations,
                    });

                    reading.skipped.forEach((notice) => toast.info(notice));

                    toast.success(
                        `Read ${reading.tables.length} tables and ${reading.relations.length} relations.`,
                    );

                    close();
                },
                /**
                 * Why it failed is not known here — too much SQL, a lost
                 * connection, a refusal — so the message does not claim one.
                 */
                onError: () => toast.error('That SQL could not be read.'),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import SQL</DialogTitle>
                    <DialogDescription>
                        Choose a .sql file, or paste the statements yourself.
                        The file is read here and never uploaded. Its tables,
                        columns and relations are added to this diagram;
                        anything a diagram cannot draw is named rather than
                        guessed at.
                    </DialogDescription>
                </DialogHeader>

                <div
                    data-test="sql-drop-zone"
                    className={cn(
                        'flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs transition-colors',
                        isDraggedOver
                            ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-800'
                            : 'border-neutral-300 dark:border-neutral-700',
                    )}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setIsDraggedOver(true);
                    }}
                    onDragLeave={() => setIsDraggedOver(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setIsDraggedOver(false);
                        void readFile(event.dataTransfer.files[0]);
                    }}
                >
                    <span className="text-muted-foreground">
                        {fileName ?? 'Drop a .sql file here'}
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        data-test="choose-sql-file"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload /> Choose a file
                    </Button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".sql,.txt,text/plain"
                        className="hidden"
                        data-test="sql-file"
                        onChange={(event) => {
                            void readFile(event.target.files?.[0]);

                            // So choosing the same file twice still counts.
                            event.target.value = '';
                        }}
                    />
                </div>

                <textarea
                    aria-label="SQL to read"
                    data-test="sql-to-import"
                    className="h-64 w-full resize-none rounded-md border border-neutral-200 bg-white p-3 font-mono text-xs outline-none focus-visible:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900"
                    placeholder={
                        'CREATE TABLE `users` (\n  `id` bigint unsigned NOT NULL AUTO_INCREMENT,\n  ...\n);'
                    }
                    value={sql}
                    onChange={(event) => {
                        setSql(event.target.value);
                        setFileName(null);
                    }}
                />

                <DialogFooter>
                    <Button variant="ghost" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        data-test="read-sql"
                        disabled={sql.trim() === '' || read.processing}
                        onClick={readTheSql}
                    >
                        {read.processing ? 'Reading…' : 'Read it'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
