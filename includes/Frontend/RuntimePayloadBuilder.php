<?php

declare(strict_types=1);

namespace LegacyPopups\Frontend;

use LegacyPopups\Domain\PopupEntity;

final class RuntimePayloadBuilder
{
    public function build_many(array $popups): array
    {
        $payloads = array();

        foreach ($popups as $popup) {
            if (! $popup instanceof PopupEntity) {
                continue;
            }

            $payload = $this->build($popup);

            if (! empty($payload['nodes'])) {
                $payloads[] = $payload;
            }
        }

        return $payloads;
    }

    public function build(PopupEntity $popup): array
    {
        $schema = $popup->builder_schema();
        $layout = isset($schema['layout']) && is_array($schema['layout']) ? $schema['layout'] : array();
        $nodes  = isset($schema['nodes']) && is_array($schema['nodes']) ? $schema['nodes'] : array();
        $triggers = $this->map_triggers($popup->trigger_schema());
        $frequency = $this->map_frequency($popup->frequency_schema());

        return array(
            'id'       => $popup->id(),
            'title'    => $popup->title(),
            'layout'   => array(
                'width'          => (int) ($layout['width'] ?? 540),
                'position'       => (string) ($layout['position'] ?? 'center'),
                'overlay'        => ! empty($layout['overlay']),
                'background'     => (string) ($layout['background'] ?? '#ffffff'),
                'borderRadius'   => (int) ($layout['borderRadius'] ?? 18),
                'padding'        => (int) ($layout['padding'] ?? 36),
                'shadow'         => (string) ($layout['shadow'] ?? 'md'),
                'overlayColor'   => (string) ($layout['overlayColor'] ?? '#000000'),
                'overlayOpacity' => (int) ($layout['overlayOpacity'] ?? 50),
                'animation'      => (string) ($layout['animation'] ?? 'fade'),
            ),
            'triggers' => $triggers,
            'frequency' => $frequency,
            'nodes'    => array_values(array_filter(array_map(array($this, 'map_node'), $nodes))),
        );
    }

    private function map_frequency(array $frequency_schema): array
    {
        $storage = isset($frequency_schema['storage']) && is_array($frequency_schema['storage'])
            ? $frequency_schema['storage']
            : array();
        $legacySessionOnce = $this->normalize_bool($frequency_schema, array('sessionOnce', 'sessiononce'), false);
        $legacyPeriodDays = $this->normalize_int($frequency_schema, array('periodDays', 'perioddays'), 0);
        $legacyMaxImpressions = $this->normalize_int($frequency_schema, array('maxImpressions', 'maximpressions'), 0);

        return array(
            'storage' => array(
                'session'        => $this->normalize_bool($storage, array('session'), true),
                'local'          => $this->normalize_bool($storage, array('local'), true),
                'cookieFallback' => $this->normalize_bool($storage, array('cookieFallback', 'cookiefallback'), true),
            ),
            'events' => array(
                'impression' => $this->normalize_frequency_event(
                    isset($frequency_schema['impression']) && is_array($frequency_schema['impression']) ? $frequency_schema['impression'] : array(),
                    array(
                        'sessionOnce'   => $legacySessionOnce,
                        'oncePerPeriod' => $legacyPeriodDays > 0,
                        'periodDays'    => $legacyPeriodDays,
                        'maxCount'      => $legacyMaxImpressions,
                    )
                ),
                'close' => $this->normalize_frequency_event(
                    isset($frequency_schema['close']) && is_array($frequency_schema['close']) ? $frequency_schema['close'] : array(),
                    array(
                        'sessionOnce'   => false,
                        'oncePerPeriod' => false,
                        'periodDays'    => 0,
                        'maxCount'      => 0,
                    )
                ),
                'conversion' => $this->normalize_frequency_event(
                    isset($frequency_schema['conversion']) && is_array($frequency_schema['conversion']) ? $frequency_schema['conversion'] : array(),
                    array(
                        'sessionOnce'   => false,
                        'oncePerPeriod' => false,
                        'periodDays'    => 0,
                        'maxCount'      => 0,
                    )
                ),
            ),
        );
    }

    private function normalize_frequency_event(array $event, array $fallback): array
    {
        $periodDays = max(0, $this->normalize_int($event, array('periodDays', 'perioddays'), $fallback['periodDays']));

        return array(
            'sessionOnce'   => $this->normalize_bool($event, array('sessionOnce', 'sessiononce'), $fallback['sessionOnce']),
            'oncePerPeriod' => $this->normalize_bool($event, array('oncePerPeriod', 'onceperperiod'), $fallback['oncePerPeriod']),
            'periodDays'    => $periodDays,
            'maxCount'      => max(0, $this->normalize_int($event, array('maxCount', 'maxcount'), $fallback['maxCount'])),
        );
    }

    private function normalize_bool(array $data, array $keys, bool $fallback): bool
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $data)) {
                continue;
            }

            if (is_bool($data[$key])) {
                return $data[$key];
            }

            if (is_numeric($data[$key])) {
                return (bool) $data[$key];
            }

            if (is_string($data[$key])) {
                return in_array(strtolower($data[$key]), array('1', 'true', 'yes', 'on'), true);
            }
        }

        return $fallback;
    }

    private function normalize_int(array $data, array $keys, int $fallback): int
    {
        foreach ($keys as $key) {
            if (! isset($data[$key]) || ! is_numeric($data[$key])) {
                continue;
            }

            return (int) $data[$key];
        }

        return $fallback;
    }

    private function map_triggers(array $trigger_schema): array
    {
        $groups = isset($trigger_schema['groups']) && is_array($trigger_schema['groups'])
            ? $trigger_schema['groups']
            : array();
        $triggers = array();

        foreach ($groups as $group) {
            if (! is_array($group)) {
                continue;
            }

            $type = $this->normalize_trigger_type(isset($group['type']) ? (string) $group['type'] : '');

            if ('page_load' === $type) {
                $triggers[] = array(
                    'type' => 'page_load',
                );
                continue;
            }

            if ('time_delay' === $type) {
                $triggers[] = array(
                    'type'    => 'time_delay',
                    'seconds' => max(0, (int) ($group['seconds'] ?? $group['delay'] ?? 0)),
                );

                continue;
            }

            if ('scroll_percent' === $type) {
                $triggers[] = array(
                    'type'    => 'scroll_percent',
                    'percent' => max(0, min(100, (int) ($group['percent'] ?? $group['percentage'] ?? $group['value'] ?? 0))),
                );

                continue;
            }

            if ('selector_hit' === $type) {
                $selector = $this->normalize_trigger_selector($group);

                if ('' === $selector) {
                    continue;
                }

                $triggers[] = array(
                    'type'     => 'selector_hit',
                    'selector' => $selector,
                );

                continue;
            }

            if ('exit_intent' === $type) {
                $triggers[] = array(
                    'type' => 'exit_intent',
                );
            }
        }

        if (empty($triggers)) {
            $triggers[] = array(
                'type' => 'page_load',
            );
        }

        return $triggers;
    }

    private function normalize_trigger_type(string $type): string
    {
        $type = sanitize_key($type);

        if (in_array($type, array('page_load', 'pageview', 'immediate'), true)) {
            return 'page_load';
        }

        if (in_array($type, array('time_delay', 'delay'), true)) {
            return 'time_delay';
        }

        if (in_array($type, array('scroll_percent', 'scroll_percentage', 'scroll_depth'), true)) {
            return 'scroll_percent';
        }

        if (in_array($type, array('selector_hit', 'selector_reach', 'selector_visible', 'element_reached', 'css_selector', 'css_id'), true)) {
            return 'selector_hit';
        }

        if (in_array($type, array('exit_intent', 'exit', 'mouse_exit'), true)) {
            return 'exit_intent';
        }

        return '';
    }

    private function normalize_trigger_selector(array $group): string
    {
        $selector = '';

        foreach (array('selector', 'cssSelector', 'cssselector', 'target', 'query') as $key) {
            if (! empty($group[$key]) && is_string($group[$key])) {
                $selector = trim((string) $group[$key]);
                break;
            }
        }

        if ('' !== $selector) {
            return $selector;
        }

        foreach (array('id', 'targetId', 'targetid', 'target_id') as $key) {
            if (! empty($group[$key]) && is_string($group[$key])) {
                return '#' . ltrim(trim((string) $group[$key]), '#');
            }
        }

        return '';
    }

    private function map_node(array $node): ?array
    {
        $type  = isset($node['type']) ? (string) $node['type'] : '';
        $props = isset($node['props']) && is_array($node['props']) ? $node['props'] : array();

        switch ($type) {
            case 'text':
                return array(
                    'type'  => 'text',
                    'props' => array(
                        'content'        => (string) ($props['content'] ?? ''),
                        'fontSize'       => (int) ($props['fontSize'] ?? 16),
                        'fontWeight'     => (int) ($props['fontWeight'] ?? 400),
                        'color'          => (string) ($props['color'] ?? '#1a1a1d'),
                        'align'          => (string) ($props['align'] ?? 'left'),
                        'lineHeight'     => (float) ($props['lineHeight'] ?? 1.5),
                        'letterSpacing'  => (float) ($props['letterSpacing'] ?? 0),
                        'textDecoration' => (string) ($props['textDecoration'] ?? 'none'),
                    ),
                );

            case 'image':
                if (empty($props['src'])) {
                    return null;
                }

                return array(
                    'type'  => 'image',
                    'props' => array(
                        'src'          => esc_url_raw((string) $props['src']),
                        'alt'          => (string) ($props['alt'] ?? ''),
                        'width'        => (string) ($props['width'] ?? '100%'),
                        'borderRadius' => (int) ($props['borderRadius'] ?? 4),
                        'shadow'       => ! empty($props['shadow']),
                        'objectFit'    => (string) ($props['objectFit'] ?? 'cover'),
                    ),
                );

            case 'button':
                return array(
                    'type'  => 'button',
                    'props' => array(
                        'label'        => (string) ($props['label'] ?? ''),
                        'url'          => esc_url_raw((string) ($props['url'] ?? '#')),
                        'variant'      => (string) ($props['variant'] ?? 'solid'),
                        'background'   => (string) ($props['background'] ?? '#0f6a5a'),
                        'color'        => (string) ($props['color'] ?? '#ffffff'),
                        'borderRadius' => (int) ($props['borderRadius'] ?? 8),
                        'fontSize'     => (int) ($props['fontSize'] ?? 14),
                        'fontWeight'   => (int) ($props['fontWeight'] ?? 600),
                        'paddingX'     => (int) ($props['paddingX'] ?? 24),
                        'paddingY'     => (int) ($props['paddingY'] ?? 10),
                        'shadow'       => ! empty($props['shadow']),
                        'width'        => (string) ($props['width'] ?? 'auto'),
                        'trackConversion' => ! empty($props['trackConversion']),
                    ),
                );

            case 'spacer':
                return array(
                    'type'  => 'spacer',
                    'props' => array(
                        'height' => (int) ($props['height'] ?? 24),
                    ),
                );

            default:
                return null;
        }
    }
}