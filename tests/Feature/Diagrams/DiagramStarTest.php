<?php

use App\Enums\TeamRole;
use App\Models\Diagram;
use App\Models\User;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->diagram = Diagram::factory()->create(['team_id' => $this->owner->currentTeam->id]);
});

/**
 * Press the star on a diagram.
 */
function toggleStar(User $user, Diagram $diagram): TestResponse
{
    return test()->actingAs($user)->post(route('diagrams.star', [
        'current_team' => $user->currentTeam->slug,
        'diagram' => $diagram->id,
    ]));
}

test('starring puts a diagram on the list and pressing again takes it off', function () {
    toggleStar($this->owner, $this->diagram);

    expect($this->diagram->starredBy()->count())->toBe(1);

    toggleStar($this->owner, $this->diagram);

    expect($this->diagram->starredBy()->count())->toBe(0);
});

test('a star belongs to whoever pressed it', function () {
    $teammate = User::factory()->create();
    $this->owner->currentTeam->members()->attach($teammate, ['role' => TeamRole::Member->value]);
    $teammate->forceFill(['current_team_id' => $this->owner->currentTeam->id])->save();

    toggleStar($this->owner, $this->diagram);

    $asSeenByTeammate = test()->actingAs($teammate->fresh())
        ->get(route('diagrams.index', ['current_team' => $this->owner->currentTeam->slug]));

    $asSeenByTeammate->assertInertia(
        fn ($page) => $page->where('diagrams.0.isStarred', false),
    );
});

test('the list says how much each diagram holds', function () {
    $this->diagram->forceFill(['document' => [
        'version' => 1,
        'nodes' => [
            ['id' => 'tbl_1', 'type' => 'table', 'position' => ['x' => 0, 'y' => 0], 'data' => ['name' => 'users', 'headerColor' => '#000', 'columns' => []]],
            ['id' => 'tbl_2', 'type' => 'table', 'position' => ['x' => 0, 'y' => 0], 'data' => ['name' => 'posts', 'headerColor' => '#000', 'columns' => []]],
            ['id' => 'note_1', 'type' => 'stickyNote', 'position' => ['x' => 0, 'y' => 0], 'data' => ['text' => 'hello', 'color' => '#fff']],
        ],
        'edges' => [['id' => 'rel_1']],
        'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
    ]])->save();

    test()->actingAs($this->owner)
        ->get(route('diagrams.index', ['current_team' => $this->owner->currentTeam->slug]))
        ->assertInertia(fn ($page) => $page
            ->where('diagrams.0.tables', 2)
            ->where('diagrams.0.relations', 1)
        );
});

test('someone outside the team cannot star its diagrams', function () {
    $stranger = User::factory()->create();

    test()->actingAs($stranger)->post(route('diagrams.star', [
        'current_team' => $this->owner->currentTeam->slug,
        'diagram' => $this->diagram->id,
    ]))->assertNotFound();
});
