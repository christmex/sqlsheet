<?php

namespace App\Http\Controllers\Diagrams;

use App\Actions\Diagrams\BuildDiagramFromSql;
use App\Http\Controllers\Controller;
use App\Http\Requests\Diagrams\ImportSqlRequest;
use App\Models\Diagram;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class DiagramSqlImportController extends Controller
{
    /**
     * Read pasted SQL and describe the tables it would draw.
     *
     * Nothing is stored here. What comes back is handed to the canvas, which
     * adds it the same way it adds a preset — so the import is an ordinary edit
     * that saves through the usual path and is undone with the usual Ctrl+Z.
     *
     * Route parameters reach a controller in the order they appear in the URL, so
     * the team slug from the `{current_team}` prefix has to be accepted even though
     * the diagram binding has already scoped the lookup to that team.
     */
    public function __invoke(
        string $currentTeamSlug,
        Diagram $diagram,
        ImportSqlRequest $request,
        BuildDiagramFromSql $buildDiagram,
    ): JsonResponse {
        Gate::authorize('update', $diagram);

        return response()->json($buildDiagram->handle($request->string('sql')->toString()));
    }
}
