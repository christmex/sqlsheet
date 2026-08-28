<?php

use App\Http\Requests\Diagrams\UpdateDiagramDocumentRequest;
use App\Models\Diagram;
use App\Models\User;
use Illuminate\Testing\TestResponse;

/**
 * Save the given document and hand back the response.
 *
 * @param  array<string, mixed>  $document
 */
function saveDocument(User $user, Diagram $diagram, array $document): TestResponse
{
    return test()->actingAs($user)->patchJson(route('diagrams.update', [
        'current_team' => $user->currentTeam->slug,
        'diagram' => $diagram->id,
    ]), ['version' => $diagram->version, 'document' => $document]);
}

/**
 * Wrap the given nodes in an otherwise valid document.
 *
 * @param  array<int, array<string, mixed>>  $nodes
 * @return array<string, mixed>
 */
function documentOfNodes(array $nodes): array
{
    return [
        'version' => 1,
        'nodes' => $nodes,
        'edges' => [],
        'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
    ];
}

/**
 * A table node holding a single primary key column.
 *
 * @return array<string, mixed>
 */
function tableNode(string $name, string $suffix = 'a'): array
{
    return [
        'id' => 'tbl_'.$suffix,
        'type' => 'table',
        'position' => ['x' => 0, 'y' => 0],
        'data' => [
            'name' => $name,
            'headerColor' => '#6366f1',
            'columns' => [[
                'id' => 'col_'.$suffix,
                'name' => 'id',
                'type' => ['kind' => 'id'],
                'isNullable' => false,
                'keys' => ['primary'],
                'defaultValue' => ['kind' => 'none'],
            ]],
        ],
    ];
}

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->diagram = Diagram::factory()->create(['team_id' => $this->owner->currentTeam->id]);
});

test('a table name that is not a string is refused rather than crashing', function () {
    $node = tableNode('users');
    $node['data']['name'] = ['not', 'a', 'string'];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertStatus(422);
});

test('a note without text is refused', function () {
    saveDocument($this->owner, $this->diagram, documentOfNodes([[
        'id' => 'note_a',
        'type' => 'stickyNote',
        'position' => ['x' => 0, 'y' => 0],
        'data' => ['whatever' => 'junk'],
    ]]))->assertJsonValidationErrors('document.nodes.0.data.text');
});

test('keys nobody validated never reach storage', function () {
    $node = tableNode('users');
    $node['data']['smuggled'] = 'payload';

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))->assertOk();

    expect($this->diagram->fresh()->document['nodes'][0]['data'])
        ->not->toHaveKey('smuggled');
});

test('a table name outside the identifier charset is refused', function () {
    saveDocument($this->owner, $this->diagram, documentOfNodes([tableNode("users'); DROP TABLE users; --")]))
        ->assertJsonValidationErrors('document.nodes.0.data.name');
});

test('a raw column definition outside the safe charset is refused', function () {
    $node = tableNode('users');
    $node['data']['columns'][0]['type'] = ['kind' => 'raw', 'definition' => "'); system('id'); //"];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.0.type.definition');
});

test('a document cannot grow past the node ceiling', function () {
    $nodes = collect(range(1, UpdateDiagramDocumentRequest::MAXIMUM_NODES + 1))
        ->map(fn (int $index) => tableNode('table_'.$index, (string) $index))
        ->all();

    saveDocument($this->owner, $this->diagram, documentOfNodes($nodes))
        ->assertJsonValidationErrors('document.nodes');
});

test('a note cannot grow past the text ceiling', function () {
    saveDocument($this->owner, $this->diagram, documentOfNodes([[
        'id' => 'note_a',
        'type' => 'stickyNote',
        'position' => ['x' => 0, 'y' => 0],
        'data' => ['text' => str_repeat('a', UpdateDiagramDocumentRequest::MAXIMUM_NOTE_LENGTH + 1), 'color' => '#fef08a'],
    ]]))->assertJsonValidationErrors('document.nodes.0.data.text');
});

test('another team is told nothing about which diagram ids exist', function () {
    $stranger = User::factory()->create();

    $existing = $this->actingAs($stranger)->get(route('diagrams.show', [
        'current_team' => $this->owner->currentTeam->slug,
        'diagram' => $this->diagram->id,
    ]));

    $imaginary = $this->actingAs($stranger)->get(route('diagrams.show', [
        'current_team' => $this->owner->currentTeam->slug,
        'diagram' => 999999,
    ]));

    expect($existing->status())->toBe($imaginary->status())
        ->and($existing->status())->toBe(404);
});

test('a save that lost the race is refused even when two arrive together', function () {
    $document = documentOfNodes([tableNode('users')]);

    saveDocument($this->owner, $this->diagram, $document)->assertOk();
    saveDocument($this->owner, $this->diagram, $document)->assertConflict();

    expect($this->diagram->fresh()->version)->toBe(2);
});

test('an ordinary column with no keys at all is accepted', function () {
    $node = tableNode('users');
    $node['data']['columns'][] = [
        'id' => 'col_plain',
        'name' => 'email',
        'type' => ['kind' => 'string', 'length' => 255],
        'isNullable' => false,
        'keys' => [],
        'defaultValue' => ['kind' => 'none'],
    ];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))->assertOk();

    expect($this->diagram->fresh()->document['nodes'][0]['data']['columns'])->toHaveCount(2);
});

test('an enum value carrying a quote is refused', function () {
    $node = tableNode('orders');
    $node['data']['columns'][] = [
        'id' => 'col_status',
        'name' => 'status',
        'type' => ['kind' => 'enum', 'values' => ['draft', "a', 'b'); DROP TABLE users; --"]],
        'isNullable' => false,
        'keys' => [],
        'defaultValue' => ['kind' => 'none'],
    ];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.1.type.values.1');
});

test('a raw definition that could begin a second column is refused', function () {
    $node = tableNode('orders');
    $node['data']['columns'][0]['type'] = ['kind' => 'raw', 'definition' => 'integer, injected_admin boolean'];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.0.type.definition');
});

test('an ordinary raw array type is still allowed', function () {
    $node = tableNode('orders');
    $node['data']['columns'][0]['type'] = ['kind' => 'raw', 'definition' => 'uuid[]'];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))->assertOk();
});

test('an indexed column is accepted', function () {
    $node = tableNode('sessions');
    $node['data']['columns'][0]['keys'] = ['index'];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))->assertOk();

    expect($this->diagram->fresh()->document['nodes'][0]['data']['columns'][0]['keys'])->toBe(['index']);
});

test('a default value carrying a quote is refused', function () {
    $node = tableNode('orders');
    $node['data']['columns'][0]['defaultValue'] = ['kind' => 'literal', 'value' => "x'); DROP TABLE users; --"];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.0.defaultValue.value');
});

test('the current time is refused as the default of a column that cannot hold it', function () {
    $node = tableNode('orders');
    $node['data']['columns'][] = [
        'id' => 'col_reference',
        'name' => 'reference',
        'type' => ['kind' => 'string', 'length' => 255],
        'isNullable' => false,
        'keys' => [],
        'defaultValue' => ['kind' => 'currentTimestamp'],
    ];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.1.defaultValue');
});

test('the current time is accepted as the default of a timestamp column', function () {
    $node = tableNode('orders');
    $node['data']['columns'][] = [
        'id' => 'col_failed_at',
        'name' => 'failed_at',
        'type' => ['kind' => 'timestamp'],
        'isNullable' => false,
        'keys' => [],
        'defaultValue' => ['kind' => 'currentTimestamp'],
    ];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))->assertOk();
});

test('a literal default with nothing to default to is refused', function () {
    $node = tableNode('orders');
    $node['data']['columns'][0]['defaultValue'] = ['kind' => 'literal'];

    saveDocument($this->owner, $this->diagram, documentOfNodes([$node]))
        ->assertJsonValidationErrors('document.nodes.0.data.columns.0.defaultValue.value');
});
