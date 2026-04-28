<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupMetaRegistrar
{
    public function register_hooks(): void
    {
        add_action('init', array($this, 'register'));
    }

    public function register(): void
    {
        foreach ($this->meta_definitions() as $meta_key => $definition) {
            register_post_meta(
                PopupPostType::POST_TYPE,
                $meta_key,
                array(
                    'single'            => true,
                    'type'              => $definition['type'],
                    'default'           => $definition['default'],
                    'sanitize_callback' => $definition['sanitize_callback'],
                    'show_in_rest'      => $definition['show_in_rest'],
                    'auth_callback'     => static function ($allowed = null, $key = '', $post_id = 0): bool {
                        if ((int) $post_id > 0) {
                            return current_user_can('edit_post', (int) $post_id);
                        }

                        return current_user_can('edit_posts');
                    },
                )
            );
        }
    }

    private function meta_definitions(): array
    {
        return array(
            PopupMeta::BUILDER_SCHEMA => array(
                'type'              => 'object',
                'default'           => PopupMeta::default_builder_schema(),
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_schema'),
                'show_in_rest'      => $this->object_rest_schema(PopupMeta::default_builder_schema()),
            ),
            PopupMeta::TRIGGER_SCHEMA => array(
                'type'              => 'object',
                'default'           => PopupMeta::default_trigger_schema(),
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_schema'),
                'show_in_rest'      => $this->object_rest_schema(PopupMeta::default_trigger_schema()),
            ),
            PopupMeta::TARGETING_SCHEMA => array(
                'type'              => 'object',
                'default'           => PopupMeta::default_targeting_schema(),
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_schema'),
                'show_in_rest'      => $this->object_rest_schema(PopupMeta::default_targeting_schema()),
            ),
            PopupMeta::DISPLAY_SCHEMA => array(
                'type'              => 'object',
                'default'           => PopupMeta::default_display_schema(),
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_schema'),
                'show_in_rest'      => $this->object_rest_schema(PopupMeta::default_display_schema()),
            ),
            PopupMeta::FREQUENCY_SCHEMA => array(
                'type'              => 'object',
                'default'           => PopupMeta::default_frequency_schema(),
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_schema'),
                'show_in_rest'      => $this->object_rest_schema(PopupMeta::default_frequency_schema()),
            ),
            PopupMeta::POPUP_STATUS => array(
                'type'              => 'string',
                'default'           => PopupStatus::DRAFT,
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_popup_status'),
                'show_in_rest'      => array(
                    'schema' => array(
                        'type'    => 'string',
                        'default' => PopupStatus::DRAFT,
                        'enum'    => PopupStatus::all(),
                    ),
                ),
            ),
            PopupMeta::SCHEDULE_FROM => array(
                'type'              => 'string',
                'default'           => '',
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_nullable_text'),
                'show_in_rest'      => array(
                    'schema' => array(
                        'type'    => 'string',
                        'default' => '',
                    ),
                ),
            ),
            PopupMeta::SCHEDULE_TO => array(
                'type'              => 'string',
                'default'           => '',
                'sanitize_callback' => array(PopupValueSanitizer::class, 'sanitize_nullable_text'),
                'show_in_rest'      => array(
                    'schema' => array(
                        'type'    => 'string',
                        'default' => '',
                    ),
                ),
            ),
        );
    }

    private function object_rest_schema(array $default): array
    {
        return array(
            'schema' => array(
                'type'                 => 'object',
                'default'              => $default,
                'additionalProperties' => true,
            ),
        );
    }
}