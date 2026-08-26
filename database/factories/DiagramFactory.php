<?php

namespace Database\Factories;

use App\Enums\ColumnKind;
use App\Enums\DiagramNodeType;
use App\Models\Diagram;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Diagram>
 */
class DiagramFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->words(2, true),
            'document' => Diagram::emptyDocument(),
            'version' => 1,
        ];
    }

    /**
     * Indicate that the diagram holds one table and no relations.
     */
    public function withSingleTable(): static
    {
        return $this->state(fn (array $attributes) => [
            'document' => [
                'version' => 1,
                'nodes' => [
                    [
                        'id' => 'tbl_'.fake()->unique()->lexify('???????????????????'),
                        'type' => DiagramNodeType::Table->value,
                        'position' => ['x' => 0, 'y' => 0],
                        'data' => [
                            'name' => 'users',
                            'headerColor' => '#6366f1',
                            'columns' => [
                                [
                                    'id' => 'col_'.fake()->unique()->lexify('???????????????????'),
                                    'name' => 'id',
                                    'type' => ['kind' => ColumnKind::Id->value],
                                    'isNullable' => false,
                                    'keys' => ['primary'],
                                    'defaultValue' => null,
                                ],
                            ],
                        ],
                    ],
                ],
                'edges' => [],
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
            ],
        ]);
    }
}
