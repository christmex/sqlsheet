<?php

namespace App\Http\Requests\Diagrams;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ImportSqlRequest extends FormRequest
{
    /**
     * The most SQL one paste may carry.
     *
     * A schema dump is text, and text is cheap to send and expensive to read:
     * the parser walks it character by character. Half a megabyte is far more
     * than any schema needs and far less than it takes to tie up the server.
     */
    public const int MAXIMUM_LENGTH = 524288;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'sql' => ['required', 'string', 'max:'.self::MAXIMUM_LENGTH],
        ];
    }
}
