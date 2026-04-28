<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupStatus
{
    public const DRAFT = 'draft';
    public const ACTIVE = 'active';
    public const PLANNED = 'planned';
    public const PAUSED = 'paused';
    public const ARCHIVED = 'archived';

    public static function all(): array
    {
        return array(
            self::DRAFT,
            self::ACTIVE,
            self::PLANNED,
            self::PAUSED,
            self::ARCHIVED,
        );
    }

    public static function is_valid(string $status): bool
    {
        return in_array($status, self::all(), true);
    }

    public static function to_post_status(string $status): string
    {
        return self::sanitize($status) === self::DRAFT ? 'draft' : 'publish';
    }

    public static function sanitize($status): string
    {
        $status = is_string($status) ? sanitize_key($status) : self::DRAFT;

        return self::is_valid($status) ? $status : self::DRAFT;
    }
}