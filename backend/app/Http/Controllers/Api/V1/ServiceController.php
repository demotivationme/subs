<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Services\ServiceResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $q = $request->input('q');

        return ServiceResource::collection(
            Service::visibleTo($request->user())
                ->when($q, fn ($query) => $query->where('name', 'ilike', '%'.addcslashes($q, '%_\\').'%'))
                ->orderByRaw('user_id IS NULL')
                ->orderBy('name')
                ->limit(50)
                ->get()
        );
    }

    public function store(ServiceRequest $request, ServiceResolver $resolver): JsonResponse
    {
        $service = $resolver->resolve($request->user(), $request->input('name'), $request->input('default_category_id'));

        return (new ServiceResource($service))->response()->setStatusCode($service->wasRecentlyCreated ? 201 : 200);
    }
}
