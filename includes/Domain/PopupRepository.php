<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

use RuntimeException;

final class PopupRepository
{
    public function query(array $args = array()): array
    {
        $popup_status = '';

        if (! empty($args['popup_status']) && PopupStatus::is_valid(PopupStatus::sanitize((string) $args['popup_status']))) {
            $popup_status = PopupStatus::sanitize((string) $args['popup_status']);
        }

        $query = new \WP_Query(
            array(
                'post_type'              => PopupPostType::POST_TYPE,
                'post_status'            => array('draft', 'publish'),
                'posts_per_page'         => isset($args['per_page']) ? max(1, min(100, (int) $args['per_page'])) : 50,
                'paged'                  => isset($args['page']) ? max(1, (int) $args['page']) : 1,
                'orderby'                => 'modified',
                'order'                  => 'DESC',
                's'                      => isset($args['search']) ? sanitize_text_field((string) $args['search']) : '',
                'no_found_rows'          => false,
                'update_post_meta_cache' => true,
                'update_post_term_cache' => false,
                'meta_query'             => '' !== $popup_status
                    ? array(
                        array(
                            'key'   => PopupMeta::POPUP_STATUS,
                            'value' => $popup_status,
                        ),
                    )
                    : array(),
            )
        );

        $items = array_map(
            function ($post): PopupEntity {
                return $this->map_post_to_entity($post);
            },
            array_filter($query->posts, static function ($post): bool {
                return $post instanceof \WP_Post;
            })
        );

        return array(
            'items'       => $items,
            'total'       => (int) $query->found_posts,
            'total_pages' => (int) $query->max_num_pages,
            'page'        => isset($args['page']) ? max(1, (int) $args['page']) : 1,
            'per_page'    => isset($args['per_page']) ? max(1, min(100, (int) $args['per_page'])) : 50,
        );
    }

    public function find_active_for_frontend(int $limit = 10): array
    {
        $query = new \WP_Query(
            array(
                'post_type'              => PopupPostType::POST_TYPE,
                'post_status'            => 'publish',
                'posts_per_page'         => max(1, min(20, $limit)),
                'orderby'                => 'modified',
                'order'                  => 'DESC',
                'no_found_rows'          => true,
                'ignore_sticky_posts'    => true,
                'update_post_meta_cache' => true,
                'update_post_term_cache' => false,
                'meta_query'             => array(
                    array(
                        'key'   => PopupMeta::POPUP_STATUS,
                        'value' => PopupStatus::ACTIVE,
                    ),
                ),
            )
        );

        return array_map(
            function ($post): PopupEntity {
                return $this->map_post_to_entity($post);
            },
            array_filter($query->posts, static function ($post): bool {
                return $post instanceof \WP_Post;
            })
        );
    }

    public function load(int $popup_id): ?PopupEntity
    {
        $post = get_post($popup_id);

        if (! $post instanceof \WP_Post || PopupPostType::POST_TYPE !== $post->post_type) {
            return null;
        }

        return $this->map_post_to_entity($post);
    }

    public function create(PopupEntity $popup): PopupEntity
    {
        if (null !== $popup->id()) {
            throw new RuntimeException('Cannot create a popup entity that already has an ID.');
        }

        $post_id = wp_insert_post($this->build_post_array($popup), true);

        if (is_wp_error($post_id)) {
            throw new RuntimeException($post_id->get_error_message());
        }

        $created = $popup->with_id((int) $post_id);
        $this->persist_meta($created);

        return $this->load((int) $post_id) ?? $created;
    }

    public function update(PopupEntity $popup): PopupEntity
    {
        if (null === $popup->id()) {
            throw new RuntimeException('Cannot update a popup entity without an ID.');
        }

        $result = wp_update_post($this->build_post_array($popup), true);

        if (is_wp_error($result)) {
            throw new RuntimeException($result->get_error_message());
        }

        $this->persist_meta($popup);

        return $this->load((int) $popup->id()) ?? $popup;
    }

    public function save(PopupEntity $popup): PopupEntity
    {
        return null === $popup->id() ? $this->create($popup) : $this->update($popup);
    }

    public function duplicate(int $popup_id): ?PopupEntity
    {
        $popup = $this->load($popup_id);

        if (null === $popup) {
            return null;
        }

        $duplicate = PopupEntity::from_array(
            array_merge(
                $popup->to_array(),
                array(
                    'id'           => null,
                    'title'        => sprintf('%s (Copy)', $popup->title()),
                    'post_status'  => 'draft',
                    'popup_status' => PopupStatus::DRAFT,
                )
            )
        );

        return $this->create($duplicate);
    }

    public function change_status(int $popup_id, string $popup_status): ?PopupEntity
    {
        $popup = $this->load($popup_id);

        if (null === $popup) {
            return null;
        }

        return $this->update($popup->with_popup_status($popup_status));
    }

    public function delete(int $popup_id): bool
    {
        $post = get_post($popup_id);

        if (! $post instanceof \WP_Post || PopupPostType::POST_TYPE !== $post->post_type) {
            return false;
        }

        return wp_delete_post($popup_id, true) instanceof \WP_Post;
    }

    private function build_post_array(PopupEntity $popup): array
    {
        $post_data = array(
            'post_type'   => PopupPostType::POST_TYPE,
            'post_title'  => $popup->title(),
            'post_status' => PopupStatus::to_post_status($popup->popup_status()),
        );

        if (null !== $popup->id()) {
            $post_data['ID'] = $popup->id();
        }

        return $post_data;
    }

    private function persist_meta(PopupEntity $popup): void
    {
        $popup_id = $popup->id();

        if (null === $popup_id) {
            return;
        }

        update_post_meta($popup_id, PopupMeta::BUILDER_SCHEMA, $popup->builder_schema());
        update_post_meta($popup_id, PopupMeta::TRIGGER_SCHEMA, $popup->trigger_schema());
        update_post_meta($popup_id, PopupMeta::TARGETING_SCHEMA, $popup->targeting_schema());
        update_post_meta($popup_id, PopupMeta::DISPLAY_SCHEMA, $popup->display_schema());
        update_post_meta($popup_id, PopupMeta::FREQUENCY_SCHEMA, $popup->frequency_schema());
        update_post_meta($popup_id, PopupMeta::POPUP_STATUS, $popup->popup_status());
        update_post_meta($popup_id, PopupMeta::SCHEDULE_FROM, $popup->schedule_from());
        update_post_meta($popup_id, PopupMeta::SCHEDULE_TO, $popup->schedule_to());
    }

    private function map_post_to_entity(\WP_Post $post): PopupEntity
    {
        return PopupEntity::from_array(
            array(
                'id'               => (int) $post->ID,
                'title'            => $post->post_title,
                'post_status'      => $post->post_status,
                'popup_status'     => get_post_meta($post->ID, PopupMeta::POPUP_STATUS, true),
                'builder_schema'   => get_post_meta($post->ID, PopupMeta::BUILDER_SCHEMA, true),
                'trigger_schema'   => get_post_meta($post->ID, PopupMeta::TRIGGER_SCHEMA, true),
                'targeting_schema' => get_post_meta($post->ID, PopupMeta::TARGETING_SCHEMA, true),
                'display_schema'   => get_post_meta($post->ID, PopupMeta::DISPLAY_SCHEMA, true),
                'frequency_schema' => get_post_meta($post->ID, PopupMeta::FREQUENCY_SCHEMA, true),
                'schedule_from'    => get_post_meta($post->ID, PopupMeta::SCHEDULE_FROM, true),
                'schedule_to'      => get_post_meta($post->ID, PopupMeta::SCHEDULE_TO, true),
            )
        );
    }
}