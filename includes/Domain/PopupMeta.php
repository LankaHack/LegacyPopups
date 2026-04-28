<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupMeta
{
    public const BUILDER_SCHEMA = '_lp_builder_schema';
    public const TRIGGER_SCHEMA = '_lp_trigger_schema';
    public const TARGETING_SCHEMA = '_lp_targeting_schema';
    public const DISPLAY_SCHEMA = '_lp_display_schema';
    public const FREQUENCY_SCHEMA = '_lp_frequency_schema';
    public const POPUP_STATUS = '_lp_popup_status';
    public const SCHEDULE_FROM = '_lp_schedule_from';
    public const SCHEDULE_TO = '_lp_schedule_to';

    public static function all(): array
    {
        return array(
            self::BUILDER_SCHEMA,
            self::TRIGGER_SCHEMA,
            self::TARGETING_SCHEMA,
            self::DISPLAY_SCHEMA,
            self::FREQUENCY_SCHEMA,
            self::POPUP_STATUS,
            self::SCHEDULE_FROM,
            self::SCHEDULE_TO,
        );
    }

    public static function default_builder_schema(): array
    {
        return BuilderSchema::default_schema();
    }

    public static function default_trigger_schema(): array
    {
        return array(
            'groups' => array(),
        );
    }

    public static function default_targeting_schema(): array
    {
        return array(
            'groups' => array(),
        );
    }

    public static function default_display_schema(): array
    {
        return array(
            'position'  => 'center',
            'overlay'   => true,
            'animation' => 'fade',
        );
    }

    public static function default_frequency_schema(): array
    {
        return array(
            'storage' => array(
                'session'        => true,
                'local'          => true,
                'cookieFallback' => true,
            ),
            'impression' => array(
                'sessionOnce'   => false,
                'oncePerPeriod' => false,
                'periodDays'    => 0,
                'maxCount'      => 0,
            ),
            'close' => array(
                'sessionOnce'   => false,
                'oncePerPeriod' => false,
                'periodDays'    => 0,
                'maxCount'      => 0,
            ),
            'conversion' => array(
                'sessionOnce'   => false,
                'oncePerPeriod' => false,
                'periodDays'    => 0,
                'maxCount'      => 0,
            ),
            'mode'           => 'always',
            'sessionOnce'    => false,
            'periodDays'     => 0,
            'maxImpressions' => 0,
        );
    }
}