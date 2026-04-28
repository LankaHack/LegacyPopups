<?php

declare(strict_types=1);

namespace LegacyPopups\Frontend;

final class RequestContext
{
    private string $url;

    private string $path;

    private string $locale;

    private string $language;

    private string $device_type;

    private bool $logged_in;

    private string $time;

    private int $weekday;

    private string $weekday_name;

    public function __construct(
        string $url,
        string $path,
        string $locale,
        string $language,
        string $device_type,
        bool $logged_in,
        string $time,
        int $weekday,
        string $weekday_name
    ) {
        $this->url          = $url;
        $this->path         = $path;
        $this->locale       = $locale;
        $this->language     = $language;
        $this->device_type  = $device_type;
        $this->logged_in    = $logged_in;
        $this->time         = $time;
        $this->weekday      = $weekday;
        $this->weekday_name = $weekday_name;
    }

    public static function from_globals(): self
    {
        $request_uri = isset($_SERVER['REQUEST_URI']) && is_string($_SERVER['REQUEST_URI'])
            ? wp_unslash($_SERVER['REQUEST_URI'])
            : '/';
        $request_uri = '' !== $request_uri ? $request_uri : '/';
        $path = (string) wp_parse_url($request_uri, PHP_URL_PATH);
        $path = '' !== $path ? $path : '/';
        $url = home_url($request_uri);
        $locale = function_exists('determine_locale') ? determine_locale() : get_locale();
        $language = strtolower(str_replace('-', '_', (string) strtok($locale, '_')));
        $datetime = new \DateTimeImmutable('now', wp_timezone());

        return new self(
            (string) $url,
            $path,
            (string) $locale,
            $language,
            self::detect_device_type(),
            is_user_logged_in(),
            $datetime->format('H:i'),
            (int) $datetime->format('N'),
            strtolower($datetime->format('D'))
        );
    }

    public function url(): string
    {
        return $this->url;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function locale(): string
    {
        return $this->locale;
    }

    public function language(): string
    {
        return $this->language;
    }

    public function device_type(): string
    {
        return $this->device_type;
    }

    public function is_logged_in(): bool
    {
        return $this->logged_in;
    }

    public function time(): string
    {
        return $this->time;
    }

    public function weekday(): int
    {
        return $this->weekday;
    }

    public function weekday_name(): string
    {
        return $this->weekday_name;
    }

    private static function detect_device_type(): string
    {
        $user_agent = isset($_SERVER['HTTP_USER_AGENT']) && is_string($_SERVER['HTTP_USER_AGENT'])
            ? strtolower(wp_unslash($_SERVER['HTTP_USER_AGENT']))
            : '';

        if ('' === $user_agent) {
            return 'desktop';
        }

        $is_tablet = false !== strpos($user_agent, 'ipad')
            || false !== strpos($user_agent, 'tablet')
            || false !== strpos($user_agent, 'playbook')
            || false !== strpos($user_agent, 'silk')
            || (false !== strpos($user_agent, 'android') && false === strpos($user_agent, 'mobile'));

        if ($is_tablet) {
            return 'tablet';
        }

        if (wp_is_mobile()) {
            return 'mobile';
        }

        return 'desktop';
    }
}