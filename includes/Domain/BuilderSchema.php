<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class BuilderSchema
{
    public const CURRENT_VERSION = 1;

    private const MAX_NODES = 50;

    private const MAX_RECURSION_DEPTH = 8;

    public static function default_schema(): array
    {
        return array(
            'version' => self::CURRENT_VERSION,
            'layout'  => array(
                'width'          => 540,
                'position'       => 'center',
                'overlay'        => true,
                'background'     => '#ffffff',
                'borderRadius'   => 18,
                'padding'        => 36,
                'shadow'         => 'md',
                'overlayColor'   => '#000000',
                'overlayOpacity' => 50,
                'animation'      => 'fade',
            ),
            'nodes'   => array(),
        );
    }

    public static function sanitize_and_migrate($value): array
    {
        if (! is_array($value)) {
            return self::default_schema();
        }

        $schema  = $value;
        $version = isset($schema['version']) ? max(1, (int) $schema['version']) : 1;

        $schema = self::migrate_to_current($schema, $version);

        return self::normalize_v1($schema);
    }

    private static function migrate_to_current(array $schema, int $version): array
    {
        while ($version < self::CURRENT_VERSION) {
            switch ($version) {
                default:
                    throw new \LogicException(sprintf('Unhandled LegacyPopups builder schema migration path from version %d.', $version));
            }
        }

        return $schema;
    }

    private static function normalize_v1(array $schema): array
    {
        return array(
            'version' => self::CURRENT_VERSION,
            'layout'  => self::normalize_layout(isset($schema['layout']) && is_array($schema['layout']) ? $schema['layout'] : array()),
            'nodes'   => self::normalize_nodes(isset($schema['nodes']) && is_array($schema['nodes']) ? $schema['nodes'] : array()),
        );
    }

    private static function normalize_layout(array $layout): array
    {
        $defaults = self::default_schema()['layout'];
        $position = isset($layout['position']) ? sanitize_key((string) $layout['position']) : $defaults['position'];
        $allowed_positions = array('center', 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right');

        $allowed_shadows    = array('none', 'sm', 'md', 'lg', 'xl');
        $shadow_raw          = isset($layout['shadow']) ? sanitize_key((string) $layout['shadow']) : $defaults['shadow'];
        $allowed_animations  = array('none', 'fade', 'slide-up', 'slide-down', 'zoom');
        $animation_raw       = isset($layout['animation']) ? sanitize_key((string) $layout['animation']) : $defaults['animation'];

        return array(
            'width'          => self::normalize_int($layout, 'width', $defaults['width'], 240, 1200),
            'position'       => in_array($position, $allowed_positions, true) ? $position : $defaults['position'],
            'overlay'        => self::normalize_bool($layout, 'overlay', $defaults['overlay']),
            'background'     => self::normalize_color($layout, 'background', $defaults['background']),
            'borderRadius'   => self::normalize_int($layout, 'borderRadius', $defaults['borderRadius'], 0, 80),
            'padding'        => self::normalize_int($layout, 'padding', $defaults['padding'], 0, 160),
            'shadow'         => in_array($shadow_raw, $allowed_shadows, true) ? $shadow_raw : $defaults['shadow'],
            'overlayColor'   => self::normalize_color($layout, 'overlayColor', $defaults['overlayColor']),
            'overlayOpacity' => self::normalize_int($layout, 'overlayOpacity', $defaults['overlayOpacity'], 0, 100),
            'animation'      => in_array($animation_raw, $allowed_animations, true) ? $animation_raw : $defaults['animation'],
        );
    }

    private static function normalize_nodes(array $nodes): array
    {
        $normalized = array();
        $index      = 0;

        foreach (array_slice($nodes, 0, self::MAX_NODES) as $node) {
            if (! is_array($node)) {
                continue;
            }

            $normalized_node = self::normalize_node($node, $index);

            if (null === $normalized_node) {
                continue;
            }

            $normalized[] = $normalized_node;
            $index++;
        }

        return $normalized;
    }

    private static function normalize_node(array $node, int $index): ?array
    {
        $type = isset($node['type']) ? sanitize_key((string) $node['type']) : 'text';
        $id   = isset($node['id']) ? sanitize_key((string) $node['id']) : '';

        if (! in_array($type, array('text', 'image', 'button', 'spacer'), true)) {
            return null;
        }

        if ('' === $id) {
            $id = 'node-' . ($index + 1);
        }

        $id = substr($id, 0, 80);

        return array(
            'id'    => $id,
            'type'  => $type,
            'props' => self::normalize_node_props($type, isset($node['props']) && is_array($node['props']) ? $node['props'] : array()),
        );
    }

    private static function normalize_node_props(string $type, array $props): array
    {
        switch ($type) {
            case 'text':
                return array(
                    'content'        => isset($props['content']) ? substr(sanitize_textarea_field((string) $props['content']), 0, 5000) : '',
                    'fontSize'       => self::normalize_int($props, 'fontSize', 16, 8, 96),
                    'fontWeight'     => self::normalize_int($props, 'fontWeight', 400, 100, 900),
                    'color'          => self::normalize_color($props, 'color', '#1a1a1d'),
                    'align'          => self::normalize_enum($props, 'align', array('left', 'center', 'right'), 'left'),
                    'lineHeight'     => self::normalize_float($props, 'lineHeight', 1.5, 1.0, 3.0),
                    'letterSpacing'  => self::normalize_float($props, 'letterSpacing', 0.0, -2.0, 8.0),
                    'textDecoration' => self::normalize_enum($props, 'textDecoration', array('none', 'underline', 'line-through'), 'none'),
                );

            case 'image':
                return array(
                    'src'          => isset($props['src']) ? esc_url_raw((string) $props['src']) : '',
                    'alt'          => isset($props['alt']) ? sanitize_text_field((string) $props['alt']) : '',
                    'width'        => isset($props['width']) ? sanitize_text_field((string) $props['width']) : '100%',
                    'borderRadius' => self::normalize_int($props, 'borderRadius', 4, 0, 80),
                    'shadow'       => self::normalize_bool($props, 'shadow', false),
                    'objectFit'    => self::normalize_enum($props, 'objectFit', array('cover', 'contain', 'fill'), 'cover'),
                );

            case 'button':
                return array(
                    'label'        => isset($props['label']) ? sanitize_text_field((string) $props['label']) : '',
                    'url'          => isset($props['url']) ? esc_url_raw((string) $props['url']) : '',
                    'variant'      => self::normalize_enum($props, 'variant', array('solid', 'outline', 'ghost'), 'solid'),
                    'background'   => self::normalize_color($props, 'background', '#0f6a5a'),
                    'color'        => self::normalize_color($props, 'color', '#ffffff'),
                    'borderRadius' => self::normalize_int($props, 'borderRadius', 8, 0, 80),
                    'fontSize'     => self::normalize_int($props, 'fontSize', 14, 8, 48),
                    'fontWeight'   => self::normalize_int($props, 'fontWeight', 600, 100, 900),
                    'paddingX'     => self::normalize_int($props, 'paddingX', 24, 4, 80),
                    'paddingY'     => self::normalize_int($props, 'paddingY', 10, 2, 40),
                    'shadow'       => self::normalize_bool($props, 'shadow', false),
                    'width'        => self::normalize_enum($props, 'width', array('auto', 'full'), 'auto'),
                    'trackConversion' => self::normalize_bool($props, 'trackConversion', false),
                );

            case 'spacer':
                return array(
                    'height' => self::normalize_int($props, 'height', 24, 4, 400),
                );

            default:
                return self::sanitize_recursive($props);
        }
    }

    private static function normalize_float(array $data, string $key, float $default, float $min, float $max): float
    {
        if (! isset($data[$key]) || ! is_numeric($data[$key])) {
            return $default;
        }

        $value = (float) $data[$key];

        if ($value < $min) {
            return $min;
        }

        if ($value > $max) {
            return $max;
        }

        return $value;
    }

    private static function normalize_int(array $data, string $key, int $default, int $min, int $max): int
    {
        if (! isset($data[$key]) || ! is_numeric($data[$key])) {
            return $default;
        }

        $value = (int) $data[$key];

        if ($value < $min) {
            return $min;
        }

        if ($value > $max) {
            return $max;
        }

        return $value;
    }

    private static function normalize_bool(array $data, string $key, bool $default): bool
    {
        if (! array_key_exists($key, $data)) {
            return $default;
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

        return $default;
    }

    private static function normalize_color(array $data, string $key, string $default): string
    {
        if (! isset($data[$key]) || ! is_string($data[$key])) {
            return $default;
        }

        $color = sanitize_hex_color($data[$key]);

        return is_string($color) && '' !== $color ? $color : $default;
    }

    private static function normalize_enum(array $data, string $key, array $allowed, string $default): string
    {
        if (! isset($data[$key])) {
            return $default;
        }

        $value = sanitize_key((string) $data[$key]);

        return in_array($value, $allowed, true) ? $value : $default;
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
}