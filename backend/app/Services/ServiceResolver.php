<?php

namespace App\Services;

use App\Models\Service;
use App\Models\User;
use App\Repositories\CategoryRepository;
use App\Repositories\ServiceRepository;

final class ServiceResolver
{
    public function __construct(
        private readonly ServiceRepository $services,
        private readonly CategoryRepository $categories,
    ) {}

    /** Catalog match first, then the user's own; otherwise a new service owned by the user. */
    public function resolve(User $user, string $name, ?int $defaultCategoryId = null): Service
    {
        $name = trim($name);

        return $this->services->findVisibleByName($user, $name)
            ?? $this->services->create($user, $name, $defaultCategoryId ?? $this->categories->other()->id);
    }
}
