<?php

namespace App\Http\Controllers\Diagrams;

use App\Actions\Diagrams\GenerateDiagramMigrations;
use App\Http\Controllers\Controller;
use App\Models\Diagram;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class DiagramMigrationExportController extends Controller
{
    /**
     * Download the diagram's tables as Laravel migration files.
     *
     * Route parameters reach a controller in the order they appear in the URL, so the
     * team slug from the `{current_team}` prefix has to be accepted even though the
     * diagram binding has already scoped the lookup to that team.
     */
    public function __invoke(
        string $currentTeamSlug,
        Diagram $diagram,
        GenerateDiagramMigrations $generateMigrations,
    ): BinaryFileResponse {
        Gate::authorize('view', $diagram);

        $migrations = $generateMigrations->handle($diagram->document, now());

        abort_if($migrations === [], 404, __('This diagram has no tables to export yet.'));

        $archivePath = tempnam(sys_get_temp_dir(), 'migrations');
        $archive = new ZipArchive;

        if ($archive->open($archivePath, ZipArchive::OVERWRITE) !== true) {
            // Nothing downstream will clean this up: the response that deletes the
            // file after sending is never built when the archive cannot be opened.
            unlink($archivePath);

            abort(500);
        }

        foreach ($migrations as $filename => $contents) {
            $archive->addFromString($filename, $contents);
        }

        $archive->close();

        return response()
            ->download($archivePath, Str::slug($diagram->name).'-migrations.zip', [
                'Content-Type' => 'application/zip',
            ])
            ->deleteFileAfterSend();
    }
}
