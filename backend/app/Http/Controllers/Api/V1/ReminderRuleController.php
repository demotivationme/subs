<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReminderRulesRequest;
use App\Http\Resources\ReminderRuleResource;
use App\Services\ReminderRuleSync;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReminderRuleController extends Controller
{
    public function showDefaults(Request $request): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($request->user()->defaultReminderRules()->orderBy('days_before')->get());
    }

    public function updateDefaults(ReminderRulesRequest $request, ReminderRuleSync $sync): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($sync->sync($request->user(), null, $request->validated('rules')));
    }

    public function showForSubscription(Request $request, int $subscription): AnonymousResourceCollection
    {
        $rules = $request->user()->subscriptions()->findOrFail($subscription)->reminderRules()->orderBy('days_before')->get();

        return ReminderRuleResource::collection($rules)->additional(['meta' => ['uses_defaults' => $rules->isEmpty()]]);
    }

    public function updateForSubscription(ReminderRulesRequest $request, ReminderRuleSync $sync, int $subscription): AnonymousResourceCollection
    {
        $model = $request->user()->subscriptions()->findOrFail($subscription);
        $rules = $sync->sync($request->user(), $model, $request->validated('rules'));

        return ReminderRuleResource::collection($rules)->additional(['meta' => ['uses_defaults' => $rules->isEmpty()]]);
    }
}
