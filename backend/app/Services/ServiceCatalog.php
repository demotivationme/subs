<?php

namespace App\Services;

use App\Data\ServiceChanges;
use App\Data\ServiceInput;
use App\Models\Service;
use App\Models\User;
use App\Repositories\ServiceRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;

/** The services a user can pick: the global catalog plus their own. */
final class ServiceCatalog
{
    private const SEARCH_LIMIT = 50;

    public function __construct(
        private readonly ServiceRepository $services,
        private readonly ServiceResolver $resolver,
        private readonly ServiceLogoStorage $logos,
    ) {}

    /** @return Collection<int, Service> */
    public function search(User $user, ?string $query): Collection
    {
        return $this->services->search($user, $query, self::SEARCH_LIMIT);
    }

    /** An existing service with that name, or a new one ($service->wasRecentlyCreated tells which). */
    public function findOrCreate(User $user, ServiceInput $input): Service
    {
        return $this->resolver->resolve($user, $input->name, $input->defaultCategoryId, $input->color);
    }

    /** Only the user's own services can change; catalog ones answer 403, others' 404. */
    public function update(User $user, int $id, ServiceChanges $changes): Service
    {
        $service = $this->ownedService($user, $id);
        $this->services->update($service, $changes->toArray());

        return $service;
    }

    /** Replaces the service's uploaded icon, deleting the previous file. */
    public function setLogo(User $user, int $id, UploadedFile $file): Service
    {
        $service = $this->ownedService($user, $id);
        $old = $service->logo_path;
        $this->services->update($service, ['logo_path' => $this->logos->store($file)]);
        $this->logos->delete([$old]);

        return $service;
    }

    public function removeLogo(User $user, int $id): void
    {
        $service = $this->ownedService($user, $id);
        $old = $service->logo_path;
        $this->services->update($service, ['logo_path' => null]);
        $this->logos->delete([$old]);
    }

    private function ownedService(User $user, int $id): Service
    {
        $service = $this->services->findVisibleOrFail($user, $id);
        Gate::forUser($user)->authorize('update', $service);

        return $service;
    }
}
