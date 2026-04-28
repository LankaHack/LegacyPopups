<?php

declare(strict_types=1);

namespace LegacyPopups\Frontend;

use LegacyPopups\Domain\PopupEntity;

final class PopupPreviewRenderer
{
    public function render_document(PopupEntity $popup): void
    {
        $schema        = $popup->builder_schema();
        $layout        = isset($schema['layout']) && is_array($schema['layout']) ? $schema['layout'] : array();
        $nodes         = isset($schema['nodes']) && is_array($schema['nodes']) ? $schema['nodes'] : array();
        $overlay_color = $this->hex_to_rgba(
            isset($layout['overlayColor']) ? (string) $layout['overlayColor'] : '#000000',
            isset($layout['overlayOpacity']) ? ((int) $layout['overlayOpacity'] / 100) : 0.5
        );
        $position      = $this->resolve_position(isset($layout['position']) ? (string) $layout['position'] : 'center');
        $box_shadow    = $this->resolve_shadow(isset($layout['shadow']) ? (string) $layout['shadow'] : 'md');
        $animation     = $this->resolve_animation(isset($layout['animation']) ? (string) $layout['animation'] : 'fade');
        $title         = $popup->title() !== '' ? $popup->title() : __('LegacyPopups Vorschau', 'legacy-popups');

        nocache_headers();
        header('X-Robots-Tag: noindex, nofollow', true);

        ?>
        <!doctype html>
        <html <?php language_attributes(); ?>>
        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title><?php echo esc_html($title); ?></title>
            <style>
                :root {
                    color-scheme: light;
                    --lp-preview-bg: #f7f3ec;
                    --lp-preview-surface: #ffffff;
                    --lp-preview-text: #1a1a1d;
                    --lp-preview-muted: #6b6457;
                    --lp-preview-accent: #0f6a5a;
                    --lp-preview-border: #e6dfd1;
                    --lp-preview-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.10);
                    --lp-preview-shadow-md: 0 8px 32px rgba(0, 0, 0, 0.15);
                    --lp-preview-shadow-lg: 0 16px 56px rgba(0, 0, 0, 0.22);
                    --lp-preview-shadow-xl: 0 24px 80px rgba(0, 0, 0, 0.28);
                }

                * { box-sizing: border-box; }

                body {
                    margin: 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    background: var(--lp-preview-bg);
                    color: var(--lp-preview-text);
                }

                .lp-preview-page {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .lp-preview-page__bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 18px;
                    background: rgba(255, 255, 255, 0.88);
                    border-bottom: 1px solid var(--lp-preview-border);
                    backdrop-filter: blur(10px);
                }

                .lp-preview-page__eyebrow {
                    margin: 0 0 4px;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: var(--lp-preview-accent);
                }

                .lp-preview-page__title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                }

                .lp-preview-page__hint {
                    margin: 2px 0 0;
                    font-size: 12px;
                    color: var(--lp-preview-muted);
                }

                .lp-preview-page__badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 999px;
                    background: #ecf4f1;
                    color: var(--lp-preview-accent);
                    font-size: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .lp-preview-stage {
                    flex: 1;
                    display: flex;
                    align-items: <?php echo esc_attr($position['align']); ?>;
                    justify-content: <?php echo esc_attr($position['justify']); ?>;
                    padding: 40px 24px;
                    background: <?php echo esc_attr(! empty($layout['overlay']) ? $overlay_color : 'transparent'); ?>;
                }

                .lp-preview-popup {
                    width: min(100%, <?php echo esc_attr((int) ($layout['width'] ?? 540)); ?>px);
                    background: <?php echo esc_attr((string) ($layout['background'] ?? '#ffffff')); ?>;
                    border-radius: <?php echo esc_attr((int) ($layout['borderRadius'] ?? 18)); ?>px;
                    padding: <?php echo esc_attr((int) ($layout['padding'] ?? 36)); ?>px;
                    box-shadow: <?php echo esc_attr($box_shadow); ?>;
                    animation: <?php echo esc_attr($animation['name']); ?> 220ms ease-out;
                    transform-origin: center;
                }

                .lp-preview-node + .lp-preview-node {
                    margin-top: 12px;
                }

                .lp-preview-node--text {
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .lp-preview-node--image img {
                    display: block;
                    max-width: 100%;
                    height: auto;
                }

                .lp-preview-node--button {
                    display: flex;
                    justify-content: center;
                }

                .lp-preview-node--button.is-full {
                    display: block;
                }

                .lp-preview-node__button {
                    text-decoration: none;
                    transition: opacity 0.15s ease;
                }

                .lp-preview-node__button:hover {
                    opacity: 0.92;
                }

                .lp-preview-node--spacer {
                    width: 100%;
                }

                @keyframes lp-preview-fade {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes lp-preview-slide-up {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes lp-preview-slide-down {
                    from { opacity: 0; transform: translateY(-18px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes lp-preview-zoom {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }

                @media (max-width: 782px) {
                    .lp-preview-page__bar {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .lp-preview-stage {
                        padding: 20px 14px;
                    }

                    .lp-preview-popup {
                        padding: min(24px, <?php echo esc_attr((int) ($layout['padding'] ?? 36)); ?>px);
                    }
                }
            </style>
        </head>
        <body>
            <div class="lp-preview-page">
                <header class="lp-preview-page__bar">
                    <div>
                        <p class="lp-preview-page__eyebrow"><?php echo esc_html__('LegacyPopups Preview', 'legacy-popups'); ?></p>
                        <h1 class="lp-preview-page__title"><?php echo esc_html($title); ?></h1>
                        <p class="lp-preview-page__hint"><?php echo esc_html__('Diese Vorschau ist nur fuer berechtigte Redakteure sichtbar und beeinflusst keine regulaeren Besucher.', 'legacy-popups'); ?></p>
                    </div>
                    <span class="lp-preview-page__badge"><?php echo esc_html__('Entwurfsvorschau', 'legacy-popups'); ?></span>
                </header>
                <main class="lp-preview-stage">
                    <section class="lp-preview-popup" aria-label="<?php echo esc_attr($title); ?>">
                        <?php foreach ($nodes as $node) : ?>
                            <?php $rendered_node = $this->render_node($node); ?>
                            <?php // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_node returns fully escaped markup from render_*_node helpers. ?>
                            <?php echo $rendered_node; ?>
                        <?php endforeach; ?>
                    </section>
                </main>
            </div>
        </body>
        </html>
        <?php
    }

    private function render_node(array $node): string
    {
        $type  = isset($node['type']) ? (string) $node['type'] : '';
        $props = isset($node['props']) && is_array($node['props']) ? $node['props'] : array();

        switch ($type) {
            case 'text':
                return $this->render_text_node($props);

            case 'image':
                return $this->render_image_node($props);

            case 'button':
                return $this->render_button_node($props);

            case 'spacer':
                return $this->render_spacer_node($props);

            default:
                return '';
        }
    }

    private function render_text_node(array $props): string
    {
        $style = sprintf(
            'font-size:%dpx;font-weight:%d;color:%s;text-align:%s;line-height:%s;letter-spacing:%spx;text-decoration:%s;',
            (int) ($props['fontSize'] ?? 16),
            (int) ($props['fontWeight'] ?? 400),
            esc_attr((string) ($props['color'] ?? '#1a1a1d')),
            esc_attr((string) ($props['align'] ?? 'left')),
            esc_attr((string) ($props['lineHeight'] ?? '1.5')),
            esc_attr((string) ($props['letterSpacing'] ?? '0')),
            esc_attr((string) ($props['textDecoration'] ?? 'none'))
        );

        return '<div class="lp-preview-node lp-preview-node--text" style="' . $style . '">' . nl2br(esc_html((string) ($props['content'] ?? ''))) . '</div>';
    }

    private function render_image_node(array $props): string
    {
        $src = isset($props['src']) ? (string) $props['src'] : '';

        if ($src === '') {
            return '';
        }

        $style = sprintf(
            'width:%s;border-radius:%dpx;object-fit:%s;box-shadow:%s;',
            esc_attr((string) ($props['width'] ?? '100%')),
            (int) ($props['borderRadius'] ?? 4),
            esc_attr((string) ($props['objectFit'] ?? 'cover')),
            ! empty($props['shadow']) ? '0 4px 18px rgba(0, 0, 0, 0.18)' : 'none'
        );

        return '<div class="lp-preview-node lp-preview-node--image"><img src="' . esc_url($src) . '" alt="' . esc_attr((string) ($props['alt'] ?? '')) . '" style="' . esc_attr($style) . '"></div>';
    }

    private function render_button_node(array $props): string
    {
        $variant     = isset($props['variant']) ? (string) $props['variant'] : 'solid';
        $background  = isset($props['background']) ? (string) $props['background'] : '#0f6a5a';
        $color       = isset($props['color']) ? (string) $props['color'] : '#ffffff';
        $is_full     = isset($props['width']) && 'full' === $props['width'];
        $button_style = sprintf(
            'display:%s;width:%s;text-align:center;padding:%dpx %dpx;border-radius:%dpx;font-size:%dpx;font-weight:%d;text-decoration:none;box-shadow:%s;',
            $is_full ? 'block' : 'inline-block',
            $is_full ? '100%' : 'auto',
            (int) ($props['paddingY'] ?? 10),
            (int) ($props['paddingX'] ?? 24),
            (int) ($props['borderRadius'] ?? 8),
            (int) ($props['fontSize'] ?? 14),
            (int) ($props['fontWeight'] ?? 600),
            ! empty($props['shadow']) ? '0 4px 14px rgba(0, 0, 0, 0.20)' : 'none'
        );

        if ('outline' === $variant) {
            $button_style .= 'border:2px solid ' . esc_attr($background) . ';color:' . esc_attr($background) . ';background:transparent;';
        } elseif ('ghost' === $variant) {
            $button_style .= 'color:' . esc_attr($background) . ';background:transparent;';
        } else {
            $button_style .= 'background:' . esc_attr($background) . ';color:' . esc_attr($color) . ';';
        }

        return '<div class="lp-preview-node lp-preview-node--button' . ($is_full ? ' is-full' : '') . '"><a class="lp-preview-node__button" href="' . esc_url((string) ($props['url'] ?? '#')) . '" style="' . esc_attr($button_style) . '">' . esc_html((string) ($props['label'] ?? 'Button')) . '</a></div>';
    }

    private function render_spacer_node(array $props): string
    {
        return '<div class="lp-preview-node lp-preview-node--spacer" style="height:' . (int) ($props['height'] ?? 24) . 'px"></div>';
    }

    private function resolve_position(string $position): array
    {
        $map = array(
            'center'        => array('align' => 'center', 'justify' => 'center'),
            'top-left'      => array('align' => 'flex-start', 'justify' => 'flex-start'),
            'top-center'    => array('align' => 'flex-start', 'justify' => 'center'),
            'top-right'     => array('align' => 'flex-start', 'justify' => 'flex-end'),
            'bottom-left'   => array('align' => 'flex-end', 'justify' => 'flex-start'),
            'bottom-center' => array('align' => 'flex-end', 'justify' => 'center'),
            'bottom-right'  => array('align' => 'flex-end', 'justify' => 'flex-end'),
        );

        return isset($map[$position]) ? $map[$position] : $map['center'];
    }

    private function resolve_shadow(string $shadow): string
    {
        $map = array(
            'none' => 'none',
            'sm'   => 'var(--lp-preview-shadow-sm)',
            'md'   => 'var(--lp-preview-shadow-md)',
            'lg'   => 'var(--lp-preview-shadow-lg)',
            'xl'   => 'var(--lp-preview-shadow-xl)',
        );

        return isset($map[$shadow]) ? $map[$shadow] : $map['md'];
    }

    private function resolve_animation(string $animation): array
    {
        $map = array(
            'none'       => array('name' => 'lp-preview-fade'),
            'fade'       => array('name' => 'lp-preview-fade'),
            'slide-up'   => array('name' => 'lp-preview-slide-up'),
            'slide-down' => array('name' => 'lp-preview-slide-down'),
            'zoom'       => array('name' => 'lp-preview-zoom'),
        );

        return isset($map[$animation]) ? $map[$animation] : $map['fade'];
    }

    private function hex_to_rgba(string $hex, float $alpha): string
    {
        $hex = ltrim($hex, '#');

        if (strlen($hex) !== 6) {
            return 'rgba(0, 0, 0, ' . $alpha . ')';
        }

        return sprintf(
            'rgba(%d, %d, %d, %s)',
            hexdec(substr($hex, 0, 2)),
            hexdec(substr($hex, 2, 2)),
            hexdec(substr($hex, 4, 2)),
            rtrim(rtrim(number_format($alpha, 2, '.', ''), '0'), '.')
        );
    }
}