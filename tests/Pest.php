<?php

use App\Actions\Diagrams\GenerateDiagramMigrations;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Write the generated migrations to a throwaway directory and run them.
 *
 * String matching only proves the generator wrote what was expected; running the
 * files is the only thing that proves Laravel accepts them.
 *
 * @param  array<string, mixed>  $document
 */
function runGeneratedMigrations(array $document): string
{
    $directory = storage_path('framework/testing/generated-migrations-'.Str::random(8));

    File::ensureDirectoryExists($directory);

    foreach ((new GenerateDiagramMigrations)->handle($document, CarbonImmutable::parse('2026-03-01 09:00:00')) as $filename => $contents) {
        File::put($directory.'/'.$filename, $contents);
    }

    test()->artisan('migrate', ['--path' => $directory, '--realpath' => true])->assertSuccessful();

    return $directory;
}
