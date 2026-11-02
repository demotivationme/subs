<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/** Uploaded service icons on the public disk. */
final class ServiceLogoStorage
{
    private const DIRECTORY = 'service-logos';

    /** @return string the stored path, relative to the disk */
    public function store(UploadedFile $file): string
    {
        return (string) Storage::disk('public')->putFile(self::DIRECTORY, $file);
    }

    /** @param iterable<string|null> $paths */
    public function delete(iterable $paths): void
    {
        foreach ($paths as $path) {
            if ($path !== null && $path !== '') {
                Storage::disk('public')->delete($path);
            }
        }
    }
}
