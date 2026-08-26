<?php

namespace App\Http\Controllers\Diagrams;

use App\Http\Controllers\Controller;
use App\Http\Requests\Diagrams\SaveDiagramRequest;
use App\Http\Requests\Diagrams\UpdateDiagramDocumentRequest;
use App\Models\Diagram;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DiagramController extends Controller
{
    /**
     * Display the current team's diagrams.
     */
    public function index(Request $request): Response
    {
        $diagrams = $request->user()->currentTeam
            ->diagrams()
            ->latest('updated_at')
            ->get()
            ->map(fn (Diagram $diagram) => [
                'id' => $diagram->id,
                'name' => $diagram->name,
                'updatedAt' => $diagram->updated_at?->toISOString(),
            ]);

        return Inertia::render('diagrams/index', [
            'diagrams' => $diagrams,
        ]);
    }

    /**
     * Store a new, empty diagram for the current team.
     */
    public function store(SaveDiagramRequest $request): RedirectResponse
    {
        $diagram = $request->user()->currentTeam->diagrams()->create([
            'name' => $request->validated('name'),
            'document' => Diagram::emptyDocument(),
        ]);

        return to_route('diagrams.show', ['diagram' => $diagram]);
    }

    /**
     * Display the diagram editor.
     *
     * Route parameters reach a controller in the order they appear in the URL, so the
     * team slug from the `{current_team}` prefix has to be accepted even though the
     * diagram binding has already scoped the lookup to that team.
     */
    public function show(string $currentTeamSlug, Diagram $diagram): Response
    {
        return Inertia::render('diagrams/show', [
            'hasTables' => $diagram->hasTables(),
            'tablePresets' => config('table_presets'),
            'diagram' => [
                'id' => $diagram->id,
                'name' => $diagram->name,
                'document' => $diagram->document,
                'version' => $diagram->version,
            ],
        ]);
    }

    /**
     * Rename the diagram.
     *
     * Kept apart from the document save so that renaming never has to carry a whole
     * canvas with it, and an autosave in flight never has to carry a name.
     */
    public function rename(SaveDiagramRequest $request, string $currentTeamSlug, Diagram $diagram): RedirectResponse
    {
        Gate::authorize('update', $diagram);

        $diagram->update(['name' => $request->validated('name')]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Diagram renamed.')]);

        return back();
    }

    /**
     * Delete the diagram.
     */
    public function destroy(string $currentTeamSlug, Diagram $diagram): RedirectResponse
    {
        Gate::authorize('delete', $diagram);

        $diagram->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Diagram deleted.')]);

        return to_route('diagrams.index');
    }

    /**
     * Replace the diagram's document, refusing a save built on a version that has moved on.
     */
    public function update(UpdateDiagramDocumentRequest $request, string $currentTeamSlug, Diagram $diagram): JsonResponse
    {
        Gate::authorize('update', $diagram);

        $expectedVersion = $request->integer('version');
        $savedVersion = $expectedVersion + 1;

        /**
         * One conditional write decides the race, rather than a read followed by a
         * write: `lockForUpdate()` compiles to nothing on SQLite, so a lock-based
         * check would be no guard at all on the driver this runs on.
         *
         * The document is encoded by hand because a query-builder update writes the
         * value straight through without applying the model's cast.
         */
        $rowsUpdated = Diagram::whereKey($diagram->id)
            ->where('version', $expectedVersion)
            ->update([
                'document' => json_encode($request->validated('document')),
                'version' => $savedVersion,
                'updated_at' => now(),
            ]);

        if ($rowsUpdated === 0) {
            return response()->json([
                'message' => __('This diagram changed somewhere else. Reload it before saving again.'),
            ], JsonResponse::HTTP_CONFLICT);
        }

        return response()->json([
            'version' => $savedVersion,
        ]);
    }
}
