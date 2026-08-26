<?php

use App\Models\Diagram;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Build a document holding one table with two columns and one relation onto itself.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function diagramDocument(array $overrides = []): array
{
    return array_replace_recursive([
        'version' => 1,
        'nodes' => [
            [
                'id' => 'tbl_users',
                'type' => 'table',
                'position' => ['x' => 0, 'y' => 0],
                'data' => [
                    'name' => 'users',
                    'headerColor' => '#6366f1',
                    'columns' => [
                        [
                            'id' => 'col_users_id',
                            'name' => 'id',
                            'type' => ['kind' => 'bigInteger'],
                            'isNullable' => false,
                            'keys' => ['primary'],
                            'defaultValue' => null,
                        ],
                        [
                            'id' => 'col_users_manager_id',
                            'name' => 'manager_id',
                            'type' => ['kind' => 'bigInteger'],
                            'isNullable' => true,
                            'keys' => ['foreign'],
                            'defaultValue' => null,
                        ],
                    ],
                ],
            ],
        ],
        'edges' => [
            [
                'id' => 'rel_users_manager',
                'source' => 'tbl_users',
                'target' => 'tbl_users',
                'sourceHandle' => 'col_users_id:right',
                'targetHandle' => 'col_users_manager_id:left',
                'data' => ['cardinality' => 'one-to-many'],
            ],
        ],
        'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
    ], $overrides);
}

/**
 * Create a user with a diagram in their current team.
 *
 * @return array{0: User, 1: Diagram}
 */
function userWithDiagram(): array
{
    $user = User::factory()->create();
    $diagram = Diagram::factory()->create(['team_id' => $user->currentTeam->id]);

    return [$user, $diagram];
}

/**
 * Build the arguments for a route pointing at the given diagram.
 *
 * @return array<string, mixed>
 */
function diagramRouteArguments(User $user, Diagram $diagram): array
{
    return [
        'current_team' => $user->currentTeam->slug,
        'diagram' => $diagram->id,
    ];
}

test('guests cannot reach the diagram list', function () {
    $user = User::factory()->create();

    $this->get(route('diagrams.index', ['current_team' => $user->currentTeam->slug]))
        ->assertRedirect(route('login'));
});

test('the diagram list only shows the current team diagrams', function () {
    [$user, $diagram] = userWithDiagram();
    Diagram::factory()->create();

    $response = $this->actingAs($user)
        ->get(route('diagrams.index', ['current_team' => $user->currentTeam->slug]));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('diagrams/index')
        ->has('diagrams', 1)
        ->where('diagrams.0.id', $diagram->id)
    );
});

test('a new diagram starts on an empty canvas', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('diagrams.store', ['current_team' => $user->currentTeam->slug]), [
            'name' => 'Billing schema',
        ])
        ->assertRedirect();

    $diagram = Diagram::firstWhere('name', 'Billing schema');

    expect($diagram->team_id)->toBe($user->currentTeam->id)
        ->and($diagram->document)->toBe(Diagram::emptyDocument())
        ->and($diagram->version)->toBe(1);
});

test('a diagram name is required', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('diagrams.store', ['current_team' => $user->currentTeam->slug]), ['name' => ''])
        ->assertSessionHasErrors('name');
});

test('the editor receives the diagram document and version', function () {
    [$user, $diagram] = userWithDiagram();

    $response = $this->actingAs($user)
        ->get(route('diagrams.show', diagramRouteArguments($user, $diagram)));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('diagrams/show')
        ->where('diagram.version', 1)
        ->where('diagram.name', $diagram->name)
        ->has('diagram.document.nodes')
    );
});

test('saving stores the document and moves the version on', function () {
    [$user, $diagram] = userWithDiagram();

    $response = $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => diagramDocument(),
        ]);

    $response->assertOk();
    $response->assertJson(['version' => 2]);

    expect($diagram->fresh()->document['nodes'][0]['data']['name'])->toBe('users');
});

test('a save built on a stale version is refused', function () {
    [$user, $diagram] = userWithDiagram();
    $diagram->version = 5;
    $diagram->save();

    $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => diagramDocument(),
        ])
        ->assertConflict();

    expect($diagram->fresh()->version)->toBe(5)
        ->and($diagram->fresh()->document)->toBe(Diagram::emptyDocument());
});

test('two tables cannot share a name', function () {
    [$user, $diagram] = userWithDiagram();

    $document = diagramDocument();
    $document['nodes'][] = $document['nodes'][0];
    $document['nodes'][1]['id'] = 'tbl_users_again';

    $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => $document,
        ])
        ->assertJsonValidationErrors('document.nodes.1.data.name');
});

test('a column type outside the canonical list is refused', function () {
    [$user, $diagram] = userWithDiagram();

    $document = diagramDocument();
    $document['nodes'][0]['data']['columns'][0]['type'] = ['kind' => 'quantumFlux'];

    $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => $document,
        ])
        ->assertJsonValidationErrors('document.nodes.0.data.columns.0.type.kind');
});

test('a relation pointing at a deleted column is refused', function () {
    [$user, $diagram] = userWithDiagram();

    $document = diagramDocument();
    array_pop($document['nodes'][0]['data']['columns']);

    $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => $document,
        ])
        ->assertJsonValidationErrors('document.edges.0.targetHandle');
});

test('a diagram from another team does not resolve', function () {
    [$user] = userWithDiagram();
    $otherTeamDiagram = Diagram::factory()->create();

    $this->actingAs($user)
        ->get(route('diagrams.show', diagramRouteArguments($user, $otherTeamDiagram)))
        ->assertNotFound();
});

test('the migrations of a diagram download as a zip', function () {
    [$user, $diagram] = userWithDiagram();
    $diagram->document = diagramDocument();
    $diagram->save();

    $response = $this->actingAs($user)
        ->get(route('diagrams.migrations', diagramRouteArguments($user, $diagram)));

    $response->assertOk();
    $response->assertHeader('content-type', 'application/zip');

    $archivePath = tempnam(sys_get_temp_dir(), 'downloaded');
    file_put_contents($archivePath, $response->streamedContent());

    $archive = new ZipArchive;
    $archive->open($archivePath);

    expect($archive->numFiles)->toBe(1)
        ->and($archive->getFromIndex(0))->toContain("Schema::create('users'");

    $archive->close();
    unlink($archivePath);
});

test('a diagram with no tables has nothing to export', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)
        ->get(route('diagrams.migrations', diagramRouteArguments($user, $diagram)))
        ->assertNotFound();
});

test('another team cannot download migrations', function () {
    [$user] = userWithDiagram();
    $otherTeamDiagram = Diagram::factory()->create();

    $this->actingAs($user)
        ->get(route('diagrams.migrations', diagramRouteArguments($user, $otherTeamDiagram)))
        ->assertNotFound();
});

test('a diagram can be renamed', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)
        ->from(route('diagrams.show', diagramRouteArguments($user, $diagram)))
        ->patch(route('diagrams.rename', diagramRouteArguments($user, $diagram)), ['name' => 'Billing v2'])
        ->assertRedirect(route('diagrams.show', diagramRouteArguments($user, $diagram)));

    expect($diagram->fresh()->name)->toBe('Billing v2');
});

test('a renamed diagram still needs a name', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)
        ->patch(route('diagrams.rename', diagramRouteArguments($user, $diagram)), ['name' => ''])
        ->assertSessionHasErrors('name');

    expect($diagram->fresh()->name)->toBe($diagram->name);
});

test('renaming never touches the stored document', function () {
    [$user, $diagram] = userWithDiagram();
    $diagram->document = diagramDocument();
    $diagram->save();

    $this->actingAs($user)
        ->patch(route('diagrams.rename', diagramRouteArguments($user, $diagram)), ['name' => 'Renamed']);

    expect($diagram->fresh()->document)->toBe($diagram->document)
        ->and($diagram->fresh()->version)->toBe($diagram->version);
});

test('a diagram can be deleted', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)
        ->delete(route('diagrams.destroy', diagramRouteArguments($user, $diagram)))
        ->assertRedirect(route('diagrams.index', ['current_team' => $user->currentTeam->slug]));

    $this->assertSoftDeleted('diagrams', ['id' => $diagram->id]);
});

test('a deleted diagram disappears from the list but is still recoverable', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)->delete(route('diagrams.destroy', diagramRouteArguments($user, $diagram)));

    $response = $this->actingAs($user)
        ->get(route('diagrams.index', ['current_team' => $user->currentTeam->slug]));

    $response->assertInertia(fn (Assert $page) => $page->has('diagrams', 0));

    expect(Diagram::withTrashed()->find($diagram->id))->not->toBeNull();
});

test('a deleted diagram can no longer be opened or saved', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)->delete(route('diagrams.destroy', diagramRouteArguments($user, $diagram)));

    $this->actingAs($user)
        ->get(route('diagrams.show', diagramRouteArguments($user, $diagram)))
        ->assertNotFound();

    $this->actingAs($user)
        ->patchJson(route('diagrams.update', diagramRouteArguments($user, $diagram)), [
            'version' => 1,
            'document' => diagramDocument(),
        ])
        ->assertNotFound();
});

test('guests cannot rename or delete a diagram', function () {
    [$user, $diagram] = userWithDiagram();

    $this->patch(route('diagrams.rename', diagramRouteArguments($user, $diagram)), ['name' => 'Nope'])
        ->assertRedirect(route('login'));

    $this->delete(route('diagrams.destroy', diagramRouteArguments($user, $diagram)))
        ->assertRedirect(route('login'));

    expect($diagram->fresh())->not->toBeNull();
});

test('a diagram name has a ceiling', function () {
    [$user, $diagram] = userWithDiagram();

    $this->actingAs($user)
        ->patch(route('diagrams.rename', diagramRouteArguments($user, $diagram)), ['name' => str_repeat('a', 256)])
        ->assertSessionHasErrors('name');
});

test('another team can neither rename nor delete a diagram', function () {
    [$user] = userWithDiagram();
    $otherTeamDiagram = Diagram::factory()->create(['name' => 'Untouched']);

    $this->actingAs($user)
        ->patch(route('diagrams.rename', diagramRouteArguments($user, $otherTeamDiagram)), ['name' => 'Taken over'])
        ->assertNotFound();

    $this->actingAs($user)
        ->delete(route('diagrams.destroy', diagramRouteArguments($user, $otherTeamDiagram)))
        ->assertNotFound();

    expect($otherTeamDiagram->fresh()->name)->toBe('Untouched');
});
