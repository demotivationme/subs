<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceLogoRequest;
use App\Http\Requests\ServiceRequest;
use App\Http\Requests\ServiceSearchRequest;
use App\Http\Requests\UpdateServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Services\ServiceCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ServiceController extends Controller
{
    public function __construct(private readonly ServiceCatalog $catalog) {}

    public function index(ServiceSearchRequest $request): AnonymousResourceCollection
    {
        return ServiceResource::collection($this->catalog->search($request->user(), $request->searchQuery()));
    }

    public function store(ServiceRequest $request): JsonResponse
    {
        $service = $this->catalog->findOrCreate($request->user(), $request->toInput());

        return (new ServiceResource($service))->response()->setStatusCode($service->wasRecentlyCreated ? 201 : 200);
    }

    public function update(UpdateServiceRequest $request, int $service): ServiceResource
    {
        return new ServiceResource($this->catalog->update($request->user(), $service, $request->toInput()));
    }

    public function storeLogo(ServiceLogoRequest $request, int $service): ServiceResource
    {
        return new ServiceResource($this->catalog->setLogo($request->user(), $service, $request->logo()));
    }

    public function destroyLogo(Request $request, int $service): Response
    {
        $this->catalog->removeLogo($request->user(), $service);

        return response()->noContent();
    }
}
