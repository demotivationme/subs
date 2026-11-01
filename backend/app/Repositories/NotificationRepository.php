<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Notifications\DatabaseNotification;

/** The in-app inbox (database notifications). */
interface NotificationRepository
{
    /** @return LengthAwarePaginator<int, DatabaseNotification> newest first */
    public function paginate(User $user, int $perPage): LengthAwarePaginator;

    public function unreadCount(User $user): int;

    /** One of the user's own; 404 otherwise. */
    public function markRead(User $user, string $id): void;

    public function markAllRead(User $user): void;
}
