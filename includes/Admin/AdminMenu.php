<?php

declare(strict_types=1);

namespace LegacyPopups\Admin;

use LegacyPopups\Domain\PopupPostType;

final class AdminMenu
{
    private DashboardPage $dashboard_page;

    public function __construct(DashboardPage $dashboard_page)
    {
        $this->dashboard_page = $dashboard_page;
    }

    public function register_hooks(): void
    {
        add_action('admin_menu', array($this, 'register'));
    }

    public function register(): void
    {
        add_menu_page(
            __('LegacyPopups', 'legacy-popups'),
            __('LegacyPopups', 'legacy-popups'),
            'manage_options',
            'legacy-popups',
            array($this->dashboard_page, 'render'),
            'dashicons-format-image',
            58
        );

        add_submenu_page(
            'legacy-popups',
            __('Dashboard', 'legacy-popups'),
            __('Dashboard', 'legacy-popups'),
            'manage_options',
            'legacy-popups',
            array($this->dashboard_page, 'render')
        );

        add_submenu_page(
            'legacy-popups',
            __('All Popups', 'legacy-popups'),
            __('All Popups', 'legacy-popups'),
            'edit_posts',
            'edit.php?post_type=' . PopupPostType::POST_TYPE
        );

        add_submenu_page(
            'legacy-popups',
            __('Add New Popup', 'legacy-popups'),
            __('Add New', 'legacy-popups'),
            'edit_posts',
            'post-new.php?post_type=' . PopupPostType::POST_TYPE
        );
    }
}