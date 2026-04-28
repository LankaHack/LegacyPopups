<?php

declare(strict_types=1);

namespace LegacyPopups\Infrastructure;

final class AnalyticsSchema
{
    public static function create_tables(): void
    {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $events_table    = self::events_table_name();
        $daily_table     = self::daily_table_name();

        $sql = "CREATE TABLE {$events_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            popup_id bigint(20) unsigned NOT NULL,
            event_type varchar(32) NOT NULL,
            session_hash char(64) NOT NULL DEFAULT '',
            visitor_hash char(64) NOT NULL DEFAULT '',
            url_path varchar(191) NOT NULL DEFAULT '',
            device_type varchar(20) NOT NULL DEFAULT '',
            country_code char(2) NOT NULL DEFAULT '',
            event_date date NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY popup_event_date (popup_id, event_date),
            KEY popup_event_type_date (popup_id, event_type, event_date),
            KEY visitor_lookup (popup_id, event_type, event_date, visitor_hash)
        ) {$charset_collate};

        CREATE TABLE {$daily_table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            popup_id bigint(20) unsigned NOT NULL,
            event_date date NOT NULL,
            impressions bigint(20) unsigned NOT NULL DEFAULT 0,
            unique_impressions bigint(20) unsigned NOT NULL DEFAULT 0,
            closes bigint(20) unsigned NOT NULL DEFAULT 0,
            clicks bigint(20) unsigned NOT NULL DEFAULT 0,
            conversions bigint(20) unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY  (id),
            UNIQUE KEY popup_date (popup_id, event_date),
            KEY event_date (event_date)
        ) {$charset_collate};";

        dbDelta($sql);
    }

    public static function events_table_name(): string
    {
        global $wpdb;

        return $wpdb->prefix . 'legacypopups_events';
    }

    public static function daily_table_name(): string
    {
        global $wpdb;

        return $wpdb->prefix . 'legacypopups_event_daily';
    }
}