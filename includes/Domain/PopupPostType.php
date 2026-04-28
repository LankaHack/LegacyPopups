<?php

declare(strict_types=1);

namespace LegacyPopups\Domain;

final class PopupPostType
{
    public const POST_TYPE = 'legacypopup';

    public function register_hooks(): void
    {
        add_action('init', array($this, 'register'));
    }

    public function register(): void
    {
        $labels = array(
            'name'               => __('Popups', 'legacy-popups'),
            'singular_name'      => __('Popup', 'legacy-popups'),
            'menu_name'          => __('Popups', 'legacy-popups'),
            'name_admin_bar'     => __('Popup', 'legacy-popups'),
            'add_new'            => __('Add New', 'legacy-popups'),
            'add_new_item'       => __('Add New Popup', 'legacy-popups'),
            'edit_item'          => __('Edit Popup', 'legacy-popups'),
            'new_item'           => __('New Popup', 'legacy-popups'),
            'view_item'          => __('View Popup', 'legacy-popups'),
            'search_items'       => __('Search Popups', 'legacy-popups'),
            'not_found'          => __('No popups found.', 'legacy-popups'),
            'not_found_in_trash' => __('No popups found in Trash.', 'legacy-popups'),
            'all_items'          => __('All Popups', 'legacy-popups'),
        );

        $args = array(
            'labels'              => $labels,
            'public'              => false,
            'show_ui'             => true,
            'show_in_menu'        => false,
            'show_in_rest'        => true,
            'rest_base'           => 'legacypopups',
            'supports'            => array('title'),
            'capability_type'     => 'post',
            'map_meta_cap'        => true,
            'hierarchical'        => false,
            'has_archive'         => false,
            'rewrite'             => false,
            'query_var'           => false,
            'menu_icon'           => 'dashicons-format-image',
            'exclude_from_search' => true,
        );

        register_post_type(self::POST_TYPE, $args);
    }
}