<?php

namespace App\Services;

use App\Data\ServiceInput;
use App\Models\Service;
use App\Models\User;
use App\Repositories\ServiceRepository;
use Illuminate\Database\Eloquent\Collection;

/** The services a user can pick: the global catalog plus their own. */
final class ServiceCatalog
{
    private const SEARCH_LIMIT = 50;

    public function __construct(
        private readonly ServiceRepository $services,
        private readonly ServiceResolver $resolver,
    ) {}

    /** @return Collection<int, Service> */
    public function search(User $user, ?string $query): Collection
    {
        return $this->services->search($user, $query, self::SEARCH_LIMIT);
    }

    /** An existing service with that name, or a new one ($service->wasRecentlyCreated tells which). */
    public function findOrCreate(User $user, ServiceInput $input): Service
    {
        return $this->resolver->resolve($user, $input->name, $input->defaultCategoryId);
    }
}
