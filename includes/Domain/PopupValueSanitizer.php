<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupValueSanitizer
{
    private const MAX_TRIGGER_GROUPS = 20;

    private const MAX_TARGETING_GROUPS = 20;

    private const MAX_RULES_PER_GROUP = 12;

    private const MAX_SELECTOR_LENGTH = 200;

    private const MAX_VALUE_LENGTH = 190;

    private const MAX_RECURSION_DEPTH = 8;

    public static function sanitize_text($value): string
    {
        return is_scalar($value) ? sanitize_text_field((string) $value) : '';
    }

    public static function sanitize_nullable_text($value): string
    {
        return '' === $value || null === $value ? '' : self::sanitize_text($value);
    }

    public static function sanitize_popup_status($value): string
    {
        return PopupStatus::sanitize($value);
    }

    public static function sanitize_schema($value): array
    {
        if (! is_array($value)) {
            return array();
        }

        return self::sanitize_recursive($value);
    }

    public static function sanitize_trigger_schema($value): array
    {
        if (! is_array($value)) {
            return PopupMeta::default_trigger_schema();
        }

        $groups = isset($value['groups']) && is_array($value['groups']) ? $value['groups'] : array();
        $normalized = array();

        foreach (array_slice($groups, 0, self::MAX_TRIGGER_GROUPS) as $group) {
            if (! is_array($group)) {
                continue;
            }

            $type = isset($group['type']) ? sanitize_key((string) $group['type']) : '';

            if ('' === $type) {
                continue;
            }

            $normalized_group = array(
                'type' => $type,
            );

            if (isset($group['seconds']) || isset($group['delay'])) {
                $normalized_group['seconds'] = self::normalize_int($group['seconds'] ?? $group['delay'], 0, 0, 86400);
            }

            if (isset($group['percent']) || isset($group['percentage']) || isset($group['value'])) {
                $normalized_group['percent'] = self::normalize_int($group['percent'] ?? $group['percentage'] ?? $group['value'], 0, 0, 100);
            }

            $selector = self::sanitize_selector($group['selector'] ?? $group['cssSelector'] ?? $group['cssselector'] ?? $group['target'] ?? $group['query'] ?? '');

            if ('' !== $selector) {
                $normalized_group['selector'] = $selector;
            }

            $id = self::sanitize_target_id($group['id'] ?? $group['targetId'] ?? $group['targetid'] ?? $group['target_id'] ?? '');

            if ('' !== $id) {
                $normalized_group['id'] = $id;
            }

            $normalized[] = $normalized_group;
        }

        return array(
            'groups' => $normalized,
        );
    }

    public static function sanitize_targeting_schema($value): array
    {
        if (! is_array($value)) {
            return PopupMeta::default_targeting_schema();
        }

        $groups = isset($value['groups']) && is_array($value['groups']) ? $value['groups'] : array();
        $normalized = array();

        foreach (array_slice($groups, 0, self::MAX_TARGETING_GROUPS) as $group) {
            if (! is_array($group)) {
                continue;
            }

            $rules = array();

            if (isset($group['rules']) && is_array($group['rules'])) {
                $rules = $group['rules'];
            } elseif (isset($group['conditions']) && is_array($group['conditions'])) {
                $rules = $group['conditions'];
            } elseif (isset($group['type'])) {
                $rules = array($group);
            }

            $normalized_rules = array();

            foreach (array_slice($rules, 0, self::MAX_RULES_PER_GROUP) as $rule) {
                if (! is_array($rule)) {
                    continue;
                }

                $normalized_rule = self::sanitize_targeting_rule($rule);

                if (! empty($normalized_rule)) {
                    $normalized_rules[] = $normalized_rule;
                }
            }

            if (! empty($normalized_rules)) {
                $normalized[] = array(
                    'rules' => $normalized_rules,
                );
            }
        }

        return array(
            'groups' => $normalized,
        );
    }

    public static function sanitize_display_schema($value): array
    {
        $defaults = PopupMeta::default_display_schema();

        if (! is_array($value)) {
            return $defaults;
        }

        $position = isset($value['position']) ? sanitize_key((string) $value['position']) : $defaults['position'];
        $animation = isset($value['animation']) ? sanitize_key((string) $value['animation']) : $defaults['animation'];
        $allowed_positions = array('center', 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right');
        $allowed_animations = array('none', 'fade', 'slide-up', 'slide-down', 'zoom');

        return array(
            'position' => in_array($position, $allowed_positions, true) ? $position : $defaults['position'],
            'overlay' => self::normalize_bool($value['overlay'] ?? null, $defaults['overlay']),
            'animation' => in_array($animation, $allowed_animations, true) ? $animation : $defaults['animation'],
        );
    }

    public static function sanitize_frequency_schema($value): array
    {
        $defaults = PopupMeta::default_frequency_schema();

        if (! is_array($value)) {
            return $defaults;
        }

        $storage = isset($value['storage']) && is_array($value['storage']) ? $value['storage'] : array();

        return array(
            'storage' => array(
                'session' => self::normalize_bool($storage['session'] ?? null, (bool) $defaults['storage']['session']),
                'local' => self::normalize_bool($storage['local'] ?? null, (bool) $defaults['storage']['local']),
                'cookieFallback' => self::normalize_bool($storage['cookieFallback'] ?? $storage['cookiefallback'] ?? null, (bool) $defaults['storage']['cookieFallback']),
            ),
            'impression' => self::sanitize_frequency_event($value['impression'] ?? array(), $defaults['impression']),
            'close' => self::sanitize_frequency_event($value['close'] ?? array(), $defaults['close']),
            'conversion' => self::sanitize_frequency_event($value['conversion'] ?? array(), $defaults['conversion']),
            'mode' => self::sanitize_frequency_mode($value['mode'] ?? $defaults['mode']),
            'sessionOnce' => self::normalize_bool($value['sessionOnce'] ?? $value['sessiononce'] ?? null, (bool) $defaults['sessionOnce']),
            'periodDays' => self::normalize_int($value['periodDays'] ?? $value['perioddays'] ?? null, (int) $defaults['periodDays'], 0, 365),
            'maxImpressions' => self::normalize_int($value['maxImpressions'] ?? $value['maximpressions'] ?? null, (int) $defaults['maxImpressions'], 0, 1000),
        );
    }

    private static function sanitize_recursive(array $value, int $depth = 0): array
    {
        if ($depth >= self::MAX_RECURSION_DEPTH) {
            return array();
        }

        $sanitized = array();

        foreach ($value as $key => $item) {
            $sanitized_key = is_string($key) ? sanitize_key($key) : $key;

            if (is_array($item)) {
                $sanitized[$sanitized_key] = self::sanitize_recursive($item, $depth + 1);
                continue;
            }

            if (is_bool($item) || is_int($item) || is_float($item) || null === $item) {
                $sanitized[$sanitized_key] = $item;
                continue;
            }

            $sanitized[$sanitized_key] = substr(sanitize_text_field((string) $item), 0, 500);
        }

        return $sanitized;
    }

    private static function sanitize_targeting_rule(array $rule): array
    {
        $type = isset($rule['type']) ? sanitize_key((string) $rule['type']) : '';

        if ('' === $type) {
            return array();
        }

        $normalized = array(
            'type' => $type,
        );

        if (isset($rule['from']) || isset($rule['start']) || isset($rule['after'])) {
            $from = self::sanitize_time_value($rule['from'] ?? $rule['start'] ?? $rule['after']);

            if ('' !== $from) {
                $normalized['from'] = $from;
            }
        }

        if (isset($rule['to']) || isset($rule['end']) || isset($rule['before'])) {
            $to = self::sanitize_time_value($rule['to'] ?? $rule['end'] ?? $rule['before']);

            if ('' !== $to) {
                $normalized['to'] = $to;
            }
        }

        $values = self::sanitize_rule_values($rule['value'] ?? $rule['values'] ?? $rule['days'] ?? $rule['weekdays'] ?? $rule['weekday'] ?? $rule['devices'] ?? $rule['device'] ?? $rule['patterns'] ?? $rule['pattern'] ?? $rule['url'] ?? $rule['status'] ?? $rule['locales'] ?? $rule['locale'] ?? $rule['languages'] ?? $rule['language'] ?? null);

        if (! empty($values)) {
            $normalized['value'] = $values;
        }

        if (isset($rule['logged_in']) && is_bool($rule['logged_in'])) {
            $normalized['value'] = array($rule['logged_in']);
        }

        return $normalized;
    }

    private static function sanitize_rule_values($value): array
    {
        if (is_string($value) && false !== strpos($value, ',')) {
            $value = array_map('trim', explode(',', $value));
        }

        if (! is_array($value)) {
            $value = array($value);
        }

        $sanitized = array();

        foreach (array_slice($value, 0, self::MAX_RULES_PER_GROUP) as $item) {
            if (is_bool($item)) {
                $sanitized[] = $item;
                continue;
            }

            if (is_numeric($item)) {
                $sanitized[] = (string) $item;
                continue;
            }

            if (! is_string($item)) {
                continue;
            }

            $clean = sanitize_text_field($item);
            $clean = substr($clean, 0, self::MAX_VALUE_LENGTH);

            if ('' !== trim($clean)) {
                $sanitized[] = $clean;
            }
        }

        return array_values(array_unique($sanitized, SORT_REGULAR));
    }

    private static function sanitize_time_value($value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $value = trim($value);

        if (1 !== preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $value)) {
            return '';
        }

        return $value;
    }

    private static function sanitize_selector($value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $value = trim($value);
        $value = preg_replace('/[\r\n\t]+/', ' ', $value);

        if (! is_string($value) || '' === $value) {
            return '';
        }

        if (false !== stripos($value, ':has(') || substr_count(strtolower($value), ':not(') > 1) {
            return '';
        }

        if (preg_match('/\[[^\]]*[*\^$|~]=/', $value) || substr_count($value, '[') > 3) {
            return '';
        }

        return substr($value, 0, self::MAX_SELECTOR_LENGTH);
    }

    private static function sanitize_target_id($value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $value = sanitize_key($value);

        return substr($value, 0, 80);
    }

    private static function sanitize_frequency_event($value, array $defaults): array
    {
        $value = is_array($value) ? $value : array();

        return array(
            'sessionOnce' => self::normalize_bool($value['sessionOnce'] ?? $value['sessiononce'] ?? null, (bool) $defaults['sessionOnce']),
            'oncePerPeriod' => self::normalize_bool($value['oncePerPeriod'] ?? $value['onceperperiod'] ?? null, (bool) $defaults['oncePerPeriod']),
            'periodDays' => self::normalize_int($value['periodDays'] ?? $value['perioddays'] ?? null, (int) $defaults['periodDays'], 0, 365),
            'maxCount' => self::normalize_int($value['maxCount'] ?? $value['maxcount'] ?? null, (int) $defaults['maxCount'], 0, 1000),
        );
    }

    private static function sanitize_frequency_mode($value): string
    {
        $mode = is_string($value) ? sanitize_key($value) : 'always';

        return in_array($mode, array('always', 'hide_after_close', 'hide_after_conversion'), true) ? $mode : 'always';
    }

    private static function normalize_bool($value, bool $default): bool
    {
        if (null === $value) {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (bool) $value;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), array('1', 'true', 'yes', 'on'), true);
        }

        return $default;
    }

    private static function normalize_int($value, int $default, int $min, int $max): int
    {
        if (! is_numeric($value)) {
            return $default;
        }

        $normalized = (int) $value;

        if ($normalized < $min) {
            return $min;
        }

        if ($normalized > $max) {
            return $max;
        }

        return $normalized;
    }
}