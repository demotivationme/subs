<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReminderRulesRequest;
use App\Http\Resources\ReminderRuleResource;
use App\Services\ReminderRuleService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;

class ReminderRuleController extends Controller
{
    public function __construct(private readonly ReminderRuleService $rules) {}

    public function showDefaults(Request $request): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($this->rules->defaults($request->user()));
    }

    public function updateDefaults(ReminderRulesRequest $request): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($this->rules->replaceDefaults($request->user(), $request->toInput()));
    }

    public function showForSubscription(Request $request, int $subscription): AnonymousResourceCollection
    {
        return $this->subscriptionRules($this->rules->forSubscription($request->user(), $subscription));
    }

    public function updateForSubscription(ReminderRulesRequest $request, int $subscription): AnonymousResourceCollection
    {
        return $this->subscriptionRules($this->rules->replaceForSubscription($request->user(), $subscription, $request->toInput()));
    }

    private function subscriptionRules(Collection $rules): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($rules)->additional(['meta' => ['uses_defaults' => $rules->isEmpty()]]);
    }
}
