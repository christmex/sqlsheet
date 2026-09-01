<?php

namespace App\Http\Controllers\Diagrams;

use App\Http\Controllers\Controller;
use App\Models\Diagram;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DiagramStarController extends Controller
{
    /**
     * Put a diagram on this person's shortlist, or take it off again.
     *
     * A star belongs to whoever pressed it, not to the diagram, so one person
     * starring something never changes what the rest of the team sees.
     *
     * Route parameters reach a controller in the order they appear in the URL, so
     * the team slug from the `{current_team}` prefix has to be accepted even though
     * the diagram binding has already scoped the lookup to that team.
     */
    public function __invoke(string $currentTeamSlug, Diagram $diagram, Request $request): RedirectResponse
    {
        Gate::authorize('view', $diagram);

        $diagram->starredBy()->toggle($request->user());

        return back();
    }
}
