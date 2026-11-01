<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\NotificationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** The in-app inbox. */
final class NotificationService
{
    private const PER_PAGE = 20;

    public function __construct(private readonly NotificationRepository $notifications) {}

    public function page(User $user): LengthAwarePaginator
    {
        return $this->notifications->paginate($user, self::PER_PAGE);
    }

    public function unreadCount(User $user): int
    {
        return $this->notifications->unreadCount($user);
    }

    public function markRead(User $user, string $id): void
    {
        $this->notifications->markRead($user, $id);
    }

    public function markAllRead(User $user): void
    {
        $this->notifications->markAllRead($user);
    }
}
