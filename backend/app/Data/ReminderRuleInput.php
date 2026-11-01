<?php

namespace App\Data;

final readonly class ReminderRuleInput
{
    /** @param list<string> $channels Channel values */
    public function __construct(
        public int $daysBefore,
        public string $timeOfDay,
        public array $channels,
    ) {}

    /** @return array{days_before: int, time_of_day: string, channels: list<string>} */
    public function toArray(): array
    {
        return ['days_before' => $this->daysBefore, 'time_of_day' => $this->timeOfDay, 'channels' => $this->channels];
    }
}
