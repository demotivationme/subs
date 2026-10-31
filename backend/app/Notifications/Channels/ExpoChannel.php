<?php

namespace App\Notifications\Channels;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;

final class ExpoChannel
{
    public const URL = 'https://exp.host/--/api/v2/push/send';

    public function send(User $notifiable, Notification $notification): void
    {
        $tokens = $notifiable->deviceTokens()->pluck('token')->all();
        if ($tokens === []) {
            return;
        }

        /** @var ExpoMessage $message */
        $message = $notification->toExpo($notifiable);

        foreach (array_chunk($tokens, 100) as $chunk) {
            $tickets = Http::acceptJson()
                ->when(config('services.expo.access_token'), fn ($http, $token) => $http->withToken($token))
                ->timeout(15)
                ->post(self::URL, array_map(fn (string $to) => [...$message->toArray(), 'to' => $to], $chunk))
                ->throw()
                ->json('data', []);

            foreach ($tickets as $i => $ticket) {
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered') {
                    DeviceToken::where('token', $chunk[$i])->delete();
                }
            }
        }
    }
}
