<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

use InvalidArgumentException;
use LegacyPopups\Infrastructure\AnalyticsSchema;
use RuntimeException;

final class AnalyticsService
{
    private const EVENT_TYPES = array('impression', 'close', 'click', 'conversion');

    private PopupRepository $popup_repository;

    public function __construct(PopupRepository $popup_repository)
    {
        $this->popup_repository = $popup_repository;
    }

    public function is_enabled(): bool
    {
        return (bool) apply_filters('legacypopups_tracking_enabled', true);
    }

    public function record_event(array $payload): array
    {
        if (! $this->is_enabled()) {
            return array(
                'accepted'     => false,
                'rate_limited' => false,
                'reason'       => 'disabled',
            );
        }

        $event = $this->normalize_event($payload);

        if (null === $this->popup_repository->load($event['popup_id'])) {
            throw new InvalidArgumentException(__('Popup not found.', 'legacy-popups'));
        }

        if (! (bool) apply_filters('legacypopups_should_track_event', true, $event['event_type'], $event['popup_id'], $payload)) {
            return array(
                'accepted'     => false,
                'rate_limited' => false,
                'reason'       => 'filtered',
            );
        }

        if ($this->is_rate_limited($event)) {
            return array(
                'accepted'     => false,
                'rate_limited' => true,
                'reason'       => 'rate_limited',
            );
        }

        $is_unique_impression = 'impression' === $event['event_type']
            && '' !== $event['visitor_hash']
            && ! $this->has_daily_impression($event['popup_id'], $event['event_date'], $event['visitor_hash']);

        $this->insert_event($event);
        $this->aggregate_daily($event, $is_unique_impression);

        return array(
            'accepted'     => true,
            'rate_limited' => false,
            'popup_id'     => $event['popup_id'],
            'event_type'   => $event['event_type'],
            'event_date'   => $event['event_date'],
        );
    }

    public function get_summary(int $popup_id, string $from = '', string $to = ''): array
    {
        global $wpdb;

        if ($popup_id <= 0 || null === $this->popup_repository->load($popup_id)) {
            throw new InvalidArgumentException(__('Popup not found.', 'legacy-popups'));
        }

        $range      = $this->normalize_date_range($from, $to);
        $daily_table = AnalyticsSchema::daily_table_name();
        $rows       = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT event_date, impressions, unique_impressions, closes, clicks, conversions
                FROM {$daily_table}
                WHERE popup_id = %d AND event_date BETWEEN %s AND %s
                ORDER BY event_date ASC",
                $popup_id,
                $range['from'],
                $range['to']
            ),
            ARRAY_A
        );

        if (! is_array($rows)) {
            throw new RuntimeException($wpdb->last_error ?: __('Could not load analytics summary.', 'legacy-popups'));
        }

        $totals = array(
            'impressions'        => 0,
            'unique_impressions' => 0,
            'closes'             => 0,
            'clicks'             => 0,
            'conversions'        => 0,
        );

        foreach ($rows as $row) {
            $totals['impressions'] += (int) ($row['impressions'] ?? 0);
            $totals['unique_impressions'] += (int) ($row['unique_impressions'] ?? 0);
            $totals['closes'] += (int) ($row['closes'] ?? 0);
            $totals['clicks'] += (int) ($row['clicks'] ?? 0);
            $totals['conversions'] += (int) ($row['conversions'] ?? 0);
        }

        return array(
            'popup_id' => $popup_id,
            'from'     => $range['from'],
            'to'       => $range['to'],
            'totals'   => $totals,
            'days'     => array_map(
                static function (array $row): array {
                    return array(
                        'date'               => (string) ($row['event_date'] ?? ''),
                        'impressions'        => (int) ($row['impressions'] ?? 0),
                        'unique_impressions' => (int) ($row['unique_impressions'] ?? 0),
                        'closes'             => (int) ($row['closes'] ?? 0),
                        'clicks'             => (int) ($row['clicks'] ?? 0),
                        'conversions'        => (int) ($row['conversions'] ?? 0),
                    );
                },
                $rows
            ),
        );
    }

    private function normalize_event(array $payload): array
    {
        $popup_id   = isset($payload['popup_id']) ? absint($payload['popup_id']) : 0;
        $event_type = isset($payload['event_type']) ? sanitize_key((string) $payload['event_type']) : '';

        if ($popup_id <= 0) {
            throw new InvalidArgumentException(__('Invalid popup id.', 'legacy-popups'));
        }

        if (! in_array($event_type, self::EVENT_TYPES, true)) {
            throw new InvalidArgumentException(__('Invalid analytics event type.', 'legacy-popups'));
        }

        $timestamp = (int) current_time('timestamp', true);

        return array(
            'popup_id'      => $popup_id,
            'event_type'    => $event_type,
            'session_hash'  => $this->hash_token($this->sanitize_token($payload['session_token'] ?? '')),
            'visitor_hash'  => $this->hash_token($this->sanitize_token($payload['visitor_token'] ?? '')),
            'url_path'      => $this->normalize_url_path(isset($payload['url']) ? (string) $payload['url'] : ''),
            'device_type'   => $this->resolve_device_type(),
            'country_code'  => '',
            'event_date'    => gmdate('Y-m-d', $timestamp),
            'created_at'    => gmdate('Y-m-d H:i:s', $timestamp),
        );
    }

    private function sanitize_token($value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $token = preg_replace('/[^A-Za-z0-9_-]/', '', $value);

        if (! is_string($token) || strlen($token) < 12) {
            return '';
        }

        return substr($token, 0, 128);
    }

    private function hash_token(string $token): string
    {
        if ('' === $token) {
            return '';
        }

        return hash_hmac('sha256', $token, wp_salt('nonce'));
    }

    private function normalize_url_path(string $url): string
    {
        if ('' === $url) {
            return '';
        }

        $parts = wp_parse_url($url);

        if (! is_array($parts)) {
            return '';
        }

        $path = isset($parts['path']) && is_string($parts['path']) ? $parts['path'] : '/';

        if ('' === $path) {
            $path = '/';
        }

        return substr(sanitize_text_field($path), 0, 191);
    }

    private function resolve_device_type(): string
    {
        $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? strtolower((string) wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '';

        if ('' === $user_agent) {
            return 'unknown';
        }

        if (false !== strpos($user_agent, 'tablet') || false !== strpos($user_agent, 'ipad')) {
            return 'tablet';
        }

        if (false !== strpos($user_agent, 'mobile') || false !== strpos($user_agent, 'android')) {
            return 'mobile';
        }

        return 'desktop';
    }

    private function is_rate_limited(array $event): bool
    {
        $config = $this->rate_limit_config();

        if ($config['window'] <= 0 || $config['max'] <= 0) {
            return false;
        }

        $remote_ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field((string) wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
        $seed      = $event['session_hash'] ?: $event['visitor_hash'] ?: hash_hmac('sha256', $remote_ip, wp_salt('nonce'));
        $key       = 'lp_rate_' . substr(hash('sha256', $seed . '|' . $event['popup_id'] . '|' . $event['event_type']), 0, 40);
        $count     = (int) get_transient($key);

        if ($count >= $config['max']) {
            return true;
        }

        set_transient($key, $count + 1, $config['window']);

        return false;
    }

    private function rate_limit_config(): array
    {
        $config = apply_filters(
            'legacypopups_analytics_rate_limit',
            array(
                'window' => 60,
                'max'    => 20,
            )
        );

        return array(
            'window' => isset($config['window']) ? max(0, (int) $config['window']) : 60,
            'max'    => isset($config['max']) ? max(0, (int) $config['max']) : 20,
        );
    }

    private function has_daily_impression(int $popup_id, string $event_date, string $visitor_hash): bool
    {
        global $wpdb;

        $table = AnalyticsSchema::events_table_name();
        $found = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT 1
                FROM {$table}
                WHERE popup_id = %d AND event_type = %s AND event_date = %s AND visitor_hash = %s
                LIMIT 1",
                $popup_id,
                'impression',
                $event_date,
                $visitor_hash
            )
        );

        return '1' === (string) $found;
    }

    private function insert_event(array $event): void
    {
        global $wpdb;

        $table  = AnalyticsSchema::events_table_name();
        $result = $wpdb->insert(
            $table,
            array(
                'popup_id'     => $event['popup_id'],
                'event_type'   => $event['event_type'],
                'session_hash' => $event['session_hash'],
                'visitor_hash' => $event['visitor_hash'],
                'url_path'     => $event['url_path'],
                'device_type'  => $event['device_type'],
                'country_code' => $event['country_code'],
                'event_date'   => $event['event_date'],
                'created_at'   => $event['created_at'],
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );

        if (false === $result) {
            throw new RuntimeException($wpdb->last_error ?: __('Could not store analytics event.', 'legacy-popups'));
        }
    }

    private function aggregate_daily(array $event, bool $is_unique_impression): void
    {
        global $wpdb;

        $metric_map = array(
            'impression' => 'impressions',
            'close'      => 'closes',
            'click'      => 'clicks',
            'conversion' => 'conversions',
        );
        $metric     = $metric_map[$event['event_type']] ?? '';

        if ('' === $metric) {
            return;
        }

        $counters = array(
            'impressions'        => 0,
            'unique_impressions' => 0,
            'closes'             => 0,
            'clicks'             => 0,
            'conversions'        => 0,
        );

        $counters[$metric] = 1;

        if ('impression' === $event['event_type'] && $is_unique_impression) {
            $counters['unique_impressions'] = 1;
        }

        $table = AnalyticsSchema::daily_table_name();
        $query = $wpdb->prepare(
            "INSERT INTO {$table}
            (popup_id, event_date, impressions, unique_impressions, closes, clicks, conversions)
            VALUES (%d, %s, %d, %d, %d, %d, %d)
            ON DUPLICATE KEY UPDATE
                impressions = impressions + VALUES(impressions),
                unique_impressions = unique_impressions + VALUES(unique_impressions),
                closes = closes + VALUES(closes),
                clicks = clicks + VALUES(clicks),
                conversions = conversions + VALUES(conversions)",
            $event['popup_id'],
            $event['event_date'],
            $counters['impressions'],
            $counters['unique_impressions'],
            $counters['closes'],
            $counters['clicks'],
            $counters['conversions']
        );

        if (false === $wpdb->query($query)) {
            throw new RuntimeException($wpdb->last_error ?: __('Could not aggregate analytics event.', 'legacy-popups'));
        }
    }

    private function normalize_date_range(string $from, string $to): array
    {
        $to_date   = $this->sanitize_date($to);
        $from_date = $this->sanitize_date($from);

        if ('' === $to_date) {
            $to_date = gmdate('Y-m-d', (int) current_time('timestamp', true));
        }

        if ('' === $from_date) {
            $from_date = gmdate('Y-m-d', strtotime($to_date . ' -29 days UTC'));
        }

        if ($from_date > $to_date) {
            $swap      = $from_date;
            $from_date = $to_date;
            $to_date   = $swap;
        }

        return array(
            'from' => $from_date,
            'to'   => $to_date,
        );
    }

    private function sanitize_date(string $value): string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return '';
        }

        return false === strtotime($value . ' 00:00:00 UTC') ? '' : $value;
    }
}