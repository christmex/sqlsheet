<?php

use App\Http\Requests\Diagrams\ImportSqlRequest;
use App\Models\Diagram;
use App\Models\User;
use Illuminate\Testing\TestResponse;

/**
 * Hand SQL to the diagram and get back what it made of it.
 */
function importSql(User $user, Diagram $diagram, string $sql): TestResponse
{
    return test()->actingAs($user)->postJson(route('diagrams.import-sql', [
        'current_team' => $user->currentTeam->slug,
        'diagram' => $diagram->id,
    ]), ['sql' => $sql]);
}

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->diagram = Diagram::factory()->create(['team_id' => $this->owner->currentTeam->id]);
});

test('pasted SQL comes back as tables and relations', function () {
    $response = importSql($this->owner, $this->diagram, <<<'SQL'
    CREATE TABLE `users` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `email` varchar(255) NOT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `users_email_unique` (`email`)
    );
    CREATE TABLE `posts` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `author_id` bigint unsigned NOT NULL,
      PRIMARY KEY (`id`),
      CONSTRAINT `posts_author_id_foreign` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
    );
    SQL);

    $response->assertOk()
        ->assertJsonPath('tables.0.name', 'users')
        ->assertJsonPath('tables.1.name', 'posts')
        ->assertJsonPath('relations.0.to.table', 'users')
        ->assertJsonPath('skipped', []);
});

test('reading SQL leaves the diagram alone', function () {
    $documentBefore = $this->diagram->document;

    importSql($this->owner, $this->diagram, 'CREATE TABLE users (id int NOT NULL);')
        ->assertOk();

    expect($this->diagram->fresh()->document)->toBe($documentBefore)
        ->and($this->diagram->fresh()->version)->toBe($this->diagram->version);
});

test('what a diagram cannot draw is named in the answer', function () {
    importSql($this->owner, $this->diagram, <<<'SQL'
    CREATE TABLE failed_jobs (
      connection text NOT NULL,
      queue text NOT NULL,
      KEY failed_jobs_index (connection, queue)
    );
    SQL)
        ->assertOk()
        ->assertJsonCount(1, 'skipped');
});

test('more SQL than one paste may carry is refused', function () {
    importSql(
        $this->owner,
        $this->diagram,
        str_repeat('a', ImportSqlRequest::MAXIMUM_LENGTH + 1),
    )->assertJsonValidationErrors('sql');
});

test('someone outside the team cannot read SQL into it', function () {
    $stranger = User::factory()->create();

    test()->actingAs($stranger)->postJson(route('diagrams.import-sql', [
        'current_team' => $this->owner->currentTeam->slug,
        'diagram' => $this->diagram->id,
    ]), ['sql' => 'CREATE TABLE users (id int NOT NULL);'])
        ->assertNotFound();
});

test('a guest cannot read SQL into a diagram', function () {
    test()->postJson(route('diagrams.import-sql', [
        'current_team' => $this->owner->currentTeam->slug,
        'diagram' => $this->diagram->id,
    ]), ['sql' => 'CREATE TABLE users (id int NOT NULL);'])
        ->assertUnauthorized();
});
