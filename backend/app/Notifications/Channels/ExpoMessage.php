<?php

namespace App\Notifications\Channels;

final readonly class ExpoMessage
{
    public function __construct(public string $title, public string $body, public array $data = []) {}

    public function toArray(): array
    {
        return ['title' => $this->title, 'body' => $this->body, 'data' => $this->data, 'sound' => 'default', 'priority' => 'high'];
    }
}
