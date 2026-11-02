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

    /**
     * Copy a bundled catalog logo to the public disk, rewriting it only when the content differs.
     *
     * @return string the stored path, relative to the disk
     */
    public function putCatalog(string $slug, string $contents): string
    {
        $path = self::DIRECTORY.'/catalog/'.$slug.'.svg';
        $disk = Storage::disk('public');

        if (! $disk->exists($path) || $disk->get($path) !== $contents) {
            $disk->put($path, $contents);
        }

        return $path;
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
