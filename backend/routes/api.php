<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DeviceController;
use App\Http\Controllers\Api\V1\EmailVerificationController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\ReminderRuleController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\WebPushController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('auth/register', [AuthController::class, 'register']);
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot']);
        Route::post('auth/reset-password', [PasswordResetController::class, 'reset']);
    });

    Route::get('auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware('signed')
        ->name('verification.verify');

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/email/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:verification');

        Route::get('dashboard', DashboardController::class);

        Route::get('me', [MeController::class, 'show']);
        Route::patch('me', [MeController::class, 'update']);
        Route::delete('me', [MeController::class, 'destroy']);

        Route::get('categories', [CategoryController::class, 'index']);
        Route::post('categories', [CategoryController::class, 'store']);
        Route::patch('categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
        Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->whereNumber('category');

        Route::get('services', [ServiceController::class, 'index']);
        Route::post('services', [ServiceController::class, 'store']);
        Route::patch('services/{service}', [ServiceController::class, 'update'])->whereNumber('service');
        Route::post('services/{service}/logo', [ServiceController::class, 'storeLogo'])->whereNumber('service');
        Route::delete('services/{service}/logo', [ServiceController::class, 'destroyLogo'])->whereNumber('service');

        Route::get('subscriptions', [SubscriptionController::class, 'index']);
        Route::post('subscriptions', [SubscriptionController::class, 'store']);
        Route::get('subscriptions/{subscription}', [SubscriptionController::class, 'show'])->whereNumber('subscription');
        Route::patch('subscriptions/{subscription}', [SubscriptionController::class, 'update'])->whereNumber('subscription');
        Route::delete('subscriptions/{subscription}', [SubscriptionController::class, 'destroy'])->whereNumber('subscription');

        Route::get('reminder-defaults', [ReminderRuleController::class, 'showDefaults']);
        Route::put('reminder-defaults', [ReminderRuleController::class, 'updateDefaults']);
        Route::get('subscriptions/{subscription}/reminders', [ReminderRuleController::class, 'showForSubscription'])->whereNumber('subscription');
        Route::put('subscriptions/{subscription}/reminders', [ReminderRuleController::class, 'updateForSubscription'])->whereNumber('subscription');

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->whereUuid('id');

        Route::post('devices', [DeviceController::class, 'store']);
        Route::delete('devices/{token}', [DeviceController::class, 'destroy'])->where('token', '.*');
        Route::post('webpush/subscribe', [WebPushController::class, 'store']);
        Route::delete('webpush/subscribe', [WebPushController::class, 'destroy']);
    });
});
