<?php

namespace App\Policies;

use App\Models\Diagram;
use App\Models\User;

/**
 * A second, independent check that a diagram belongs to the acting user's team.
 *
 * The route model binding already scopes every lookup that way, which makes this
 * redundant today — deliberately. The whole tenant boundary otherwise rests on one
 * closure in a service provider, and simplifying that closure would open all seven
 * diagram routes at once with every existing test still passing.
 */
class DiagramPolicy
{
    /**
     * Determine whether the user can view the diagram.
     */
    public function view(User $user, Diagram $diagram): bool
    {
        return $user->belongsToTeam($diagram->team);
    }

    /**
     * Determine whether the user can update the diagram.
     */
    public function update(User $user, Diagram $diagram): bool
    {
        return $this->view($user, $diagram);
    }

    /**
     * Determine whether the user can delete the diagram.
     */
    public function delete(User $user, Diagram $diagram): bool
    {
        return $this->view($user, $diagram);
    }
}
