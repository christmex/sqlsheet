<?php

use App\Http\Controllers\Diagrams\DiagramController;
use App\Http\Controllers\Diagrams\DiagramMigrationExportController;
use App\Http\Controllers\Diagrams\DiagramSqlImportController;
use App\Http\Controllers\Diagrams\DiagramStarController;
use App\Http\Controllers\Teams\TeamInvitationController;
use App\Http\Middleware\EnsureTeamMembership;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::prefix('{current_team}')
    ->middleware(['auth', 'verified', EnsureTeamMembership::class])
    ->group(function () {
        Route::get('diagrams', [DiagramController::class, 'index'])->name('diagrams.index');
        Route::post('diagrams', [DiagramController::class, 'store'])->name('diagrams.store');
        Route::get('diagrams/{diagram}', [DiagramController::class, 'show'])->name('diagrams.show');
        Route::get('diagrams/{diagram}/migrations', DiagramMigrationExportController::class)
            ->middleware('throttle:30,1')
            ->name('diagrams.migrations');
        Route::patch('diagrams/{diagram}/name', [DiagramController::class, 'rename'])
            ->middleware('throttle:60,1')
            ->name('diagrams.rename');
        Route::delete('diagrams/{diagram}', [DiagramController::class, 'destroy'])
            ->middleware('throttle:20,1')
            ->name('diagrams.destroy');
        Route::post('diagrams/{diagram}/star', DiagramStarController::class)
            ->middleware('throttle:60,1')
            ->name('diagrams.star');
        Route::post('diagrams/{diagram}/sql', DiagramSqlImportController::class)
            ->middleware('throttle:30,1')
            ->name('diagrams.import-sql');
        Route::patch('diagrams/{diagram}', [DiagramController::class, 'update'])
            ->middleware('throttle:120,1')
            ->name('diagrams.update');
    });

Route::middleware(['auth'])->group(function () {
    Route::post('invitations/{invitation}/accept', [TeamInvitationController::class, 'accept'])->name('invitations.accept');
    Route::delete('invitations/{invitation}', [TeamInvitationController::class, 'decline'])->name('invitations.decline');
});

require __DIR__.'/settings.php';
