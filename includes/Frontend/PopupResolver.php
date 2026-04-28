<?php

declare(strict_types=1);

namespace LegacyPopups\Frontend;

use LegacyPopups\Domain\PopupEntity;

final class PopupResolver
{
    public function resolve(array $popups, RequestContext $context): array
    {
        $resolved = array_values(array_filter($popups, function ($popup) use ($context): bool {
            return $popup instanceof PopupEntity && $this->matches_popup($popup, $context);
        }));

        return apply_filters('legacypopups_resolved_popups', $resolved, $context, $popups);
    }

    private function matches_popup(PopupEntity $popup, RequestContext $context): bool
    {
        $groups = $this->normalize_groups($popup->targeting_schema());

        if (empty($groups)) {
            return true;
        }

        foreach ($groups as $group) {
            if ($this->matches_group($group, $context)) {
                return true;
            }
        }

        return false;
    }

    private function normalize_groups(array $targeting_schema): array
    {
        $groups = isset($targeting_schema['groups']) && is_array($targeting_schema['groups'])
            ? $targeting_schema['groups']
            : array();
        $normalized = array();

        foreach ($groups as $group) {
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

            $rules = array_values(array_filter($rules, static function ($rule): bool {
                return is_array($rule) && isset($rule['type']);
            }));

            if (! empty($rules)) {
                $normalized[] = $rules;
            }
        }

        return $normalized;
    }

    private function matches_group(array $rules, RequestContext $context): bool
    {
        foreach ($rules as $rule) {
            if (! $this->matches_rule($rule, $context)) {
                return false;
            }
        }

        return true;
    }

    private function matches_rule(array $rule, RequestContext $context): bool
    {
        $type = $this->normalize_rule_type(isset($rule['type']) ? (string) $rule['type'] : '');

        if ('' === $type) {
            return true;
        }

        if ('time' === $type) {
            return $this->matches_time_rule($rule, $context);
        }

        if ('weekday' === $type) {
            return $this->matches_weekday_rule($rule, $context);
        }

        if ('device' === $type) {
            return $this->matches_device_rule($rule, $context);
        }

        if ('url' === $type) {
            return $this->matches_url_rule($rule, $context);
        }

        if ('login_status' === $type) {
            return $this->matches_login_rule($rule, $context);
        }

        if ('locale' === $type) {
            return $this->matches_locale_rule($rule, $context);
        }

        return true;
    }

    private function normalize_rule_type(string $type): string
    {
        $type = sanitize_key($type);

        if (in_array($type, array('time', 'time_range', 'hour'), true)) {
            return 'time';
        }

        if (in_array($type, array('weekday', 'weekdays', 'day_of_week'), true)) {
            return 'weekday';
        }

        if (in_array($type, array('device', 'device_type', 'device_types'), true)) {
            return 'device';
        }

        if (in_array($type, array('url', 'url_pattern', 'path', 'pathname'), true)) {
            return 'url';
        }

        if (in_array($type, array('login_status', 'logged_in', 'user_status', 'auth'), true)) {
            return 'login_status';
        }

        if (in_array($type, array('locale', 'language', 'lang'), true)) {
            return 'locale';
        }

        return '';
    }

    private function matches_time_rule(array $rule, RequestContext $context): bool
    {
        $start = $this->normalize_time_value($rule, array('from', 'start', 'after'));
        $end   = $this->normalize_time_value($rule, array('to', 'end', 'before'));

        if ('' === $start && '' === $end) {
            return true;
        }

        $current = $context->time();

        if ('' !== $start && '' !== $end) {
            if ($start <= $end) {
                return $current >= $start && $current <= $end;
            }

            return $current >= $start || $current <= $end;
        }

        if ('' !== $start) {
            return $current >= $start;
        }

        return $current <= $end;
    }

    private function matches_weekday_rule(array $rule, RequestContext $context): bool
    {
        $values = $this->normalize_rule_values($rule, array('days', 'weekdays', 'weekday', 'value'));

        if (empty($values)) {
            return true;
        }

        $current_weekday = $context->weekday();
        $current_name = $context->weekday_name();
        $map = array(
            'mon' => 1,
            'monday' => 1,
            'mo' => 1,
            'tue' => 2,
            'tuesday' => 2,
            'tu' => 2,
            'wed' => 3,
            'wednesday' => 3,
            'we' => 3,
            'thu' => 4,
            'thursday' => 4,
            'th' => 4,
            'fri' => 5,
            'friday' => 5,
            'fr' => 5,
            'sat' => 6,
            'saturday' => 6,
            'sa' => 6,
            'sun' => 7,
            'sunday' => 7,
            'su' => 7,
        );

        foreach ($values as $value) {
            if (is_numeric($value) && (int) $value === $current_weekday) {
                return true;
            }

            $normalized = strtolower((string) $value);

            if ($normalized === $current_name) {
                return true;
            }

            if (isset($map[$normalized]) && $map[$normalized] === $current_weekday) {
                return true;
            }
        }

        return false;
    }

    private function matches_device_rule(array $rule, RequestContext $context): bool
    {
        $values = array_map('sanitize_key', $this->normalize_rule_values($rule, array('devices', 'device', 'value')));

        if (empty($values)) {
            return true;
        }

        return in_array($context->device_type(), $values, true);
    }

    private function matches_url_rule(array $rule, RequestContext $context): bool
    {
        $values = $this->normalize_rule_values($rule, array('patterns', 'pattern', 'url', 'value'));

        if (empty($values)) {
            return true;
        }

        $url = strtolower($context->url());
        $path = strtolower($context->path());

        foreach ($values as $value) {
            $pattern = strtolower(trim((string) $value));

            if ('' === $pattern) {
                continue;
            }

            if ($this->matches_url_pattern($pattern, $url, $path)) {
                return true;
            }
        }

        return false;
    }

    private function matches_login_rule(array $rule, RequestContext $context): bool
    {
        $values = $this->normalize_rule_values($rule, array('status', 'value', 'logged_in'));

        if (empty($values)) {
            return true;
        }

        foreach ($values as $value) {
            if (is_bool($value)) {
                return $context->is_logged_in() === $value;
            }

            $normalized = sanitize_key((string) $value);

            if (in_array($normalized, array('any', 'all'), true)) {
                return true;
            }

            if (in_array($normalized, array('loggedin', 'logged_in', 'in', 'yes', 'true', '1'), true) && $context->is_logged_in()) {
                return true;
            }

            if (in_array($normalized, array('loggedout', 'logged_out', 'out', 'no', 'false', '0'), true) && ! $context->is_logged_in()) {
                return true;
            }
        }

        return false;
    }

    private function matches_locale_rule(array $rule, RequestContext $context): bool
    {
        $values = $this->normalize_rule_values($rule, array('locales', 'locale', 'languages', 'language', 'value'));

        if (empty($values)) {
            return true;
        }

        $locale = strtolower(str_replace('-', '_', $context->locale()));
        $language = strtolower($context->language());

        foreach ($values as $value) {
            $normalized = strtolower(str_replace('-', '_', trim((string) $value)));

            if ('' === $normalized) {
                continue;
            }

            if ($normalized === $locale || $normalized === $language) {
                return true;
            }

            if (0 === strpos($locale, $normalized . '_')) {
                return true;
            }
        }

        return false;
    }

    private function normalize_rule_values(array $rule, array $keys): array
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $rule)) {
                continue;
            }

            $value = $rule[$key];

            if (is_array($value)) {
                return array_values($value);
            }

            if (is_string($value) && false !== strpos($value, ',')) {
                return array_map('trim', explode(',', $value));
            }

            return array($value);
        }

        return array();
    }

    private function normalize_time_value(array $rule, array $keys): string
    {
        foreach ($keys as $key) {
            if (empty($rule[$key]) || ! is_string($rule[$key])) {
                continue;
            }

            $time = trim($rule[$key]);

            if (preg_match('/^(?:[01]?\d|2[0-3]):[0-5]\d$/', $time)) {
                return strlen($time) === 4 ? '0' . $time : $time;
            }
        }

        return '';
    }

    private function matches_url_pattern(string $pattern, string $url, string $path): bool
    {
        if (false !== strpos($pattern, '*')) {
            $regex = '#^' . str_replace('\*', '.*', preg_quote($pattern, '#')) . '$#i';

            return 1 === preg_match($regex, $url) || 1 === preg_match($regex, $path);
        }

        return false !== strpos($url, $pattern) || false !== strpos($path, $pattern);
    }
}