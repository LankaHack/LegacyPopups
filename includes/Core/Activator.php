<?php

declare(strict_types=1);

namespace LegacyPopups\Core;

use LegacyPopups\Domain\PopupPostType;
use LegacyPopups\Infrastructure\AnalyticsSchema;

final class Activator
{
    public static function activate(): void
    {
        (new PopupPostType())->register();
        AnalyticsSchema::create_tables();

        flush_rewrite_rules();
    }
}