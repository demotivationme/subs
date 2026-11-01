<?php

namespace App\Data;

final readonly class WebPushInput
{
    public function __construct(
        public string $endpoint,
        public string $publicKey,
        public string $authToken,
        public string $contentEncoding,
    ) {}
}
