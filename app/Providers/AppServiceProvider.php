<?php

namespace App\Providers;

use App\Models\Diagram;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRouteBindings();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Resolve a diagram within the team that owns it, and only for a member of it.
     *
     * Binding on the id alone would let any team's URL open any diagram. Scoping to
     * the acting user's own teams as well means another team's URL answers the same
     * way whether or not the diagram exists, instead of telling a stranger which
     * ids are real by answering 403 for some and 404 for others.
     *
     * Authentication is resolved before route bindings are substituted, so the
     * acting user is known here.
     */
    protected function configureRouteBindings(): void
    {
        Route::bind('diagram', fn (string $diagramId, RoutingRoute $route): Diagram => Diagram::query()
            ->whereRelation('team', 'slug', $route->parameter('current_team'))
            ->whereHas('team.memberships', fn (Builder $membership) => $membership
                ->where('user_id', request()->user()?->id))
            ->whereKey($diagramId)
            ->firstOrFail());
    }
}
