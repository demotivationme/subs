<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Service icons on the logo disk (config subs.logo_disk: the local public disk or R2).
 * Callers keep only the returned relative path; url() turns it into a link at read time.
 */
final class ServiceLogoStorage
{
    private const DIRECTORY = 'service-logos';

    /** @return string the stored path, relative to the disk */
    public function store(UploadedFile $file): string
    {
        return (string) $this->disk()->putFile(self::DIRECTORY, $file);
    }

    /**
     * Copy a bundled catalog logo to the logo disk, rewriting it only when the content differs.
     *
     * @return string the stored path, relative to the disk
     */
    public function putCatalog(string $slug, string $contents): string
    {
        $path = self::DIRECTORY.'/catalog/'.$slug.'.svg';
        $disk = $this->disk();

        if (! $disk->exists($path) || $disk->get($path) !== $contents) {
            $disk->put($path, $contents);
        }

        return $path;
    }

    public function url(?string $path): ?string
    {
        return $path === null || $path === '' ? null : $this->disk()->url($path);
    }

    /** @param iterable<string|null> $paths */
    public function delete(iterable $paths): void
    {
        foreach ($paths as $path) {
            if ($path !== null && $path !== '') {
                $this->disk()->delete($path);
            }
        }
    }

    private function disk(): Filesystem
    {
        return Storage::disk(config('subs.logo_disk'));
    }
}
