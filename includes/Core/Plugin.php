<?php

declare(strict_types=1);

namespace LegacyPopups\Core;

use LegacyPopups\Admin\AdminMenu;
use LegacyPopups\Admin\DashboardPage;
use LegacyPopups\Domain\AnalyticsService;
use LegacyPopups\Domain\ImportExportService;
use LegacyPopups\Domain\PopupMetaRegistrar;
use LegacyPopups\Domain\PopupPostType;
use LegacyPopups\Domain\PopupRepository;
use LegacyPopups\Frontend\PopupResolver;
use LegacyPopups\Frontend\PreviewController;
use LegacyPopups\Frontend\RuntimePayloadBuilder;
use LegacyPopups\Rest\RestRegistrar;

final class Plugin
{
    private static ?self $instance = null;

    private bool $booted = false;

    private PopupPostType $popup_post_type;

    private PopupMetaRegistrar $popup_meta_registrar;

    private PopupRepository $popup_repository;

    private AdminMenu $admin_menu;

    private Assets $assets;

    private RestRegistrar $rest_registrar;

    private PreviewController $preview_controller;

    private AnalyticsService $analytics_service;

    private ImportExportService $import_export_service;

    private function __construct()
    {
        $dashboard_page             = new DashboardPage();
        $this->popup_post_type      = new PopupPostType();
        $this->popup_meta_registrar = new PopupMetaRegistrar();
        $this->popup_repository     = new PopupRepository();
        $this->analytics_service    = new AnalyticsService($this->popup_repository);
        $this->import_export_service = new ImportExportService($this->popup_repository);
        $this->admin_menu           = new AdminMenu($dashboard_page);
        $this->assets               = new Assets($this->popup_repository, new RuntimePayloadBuilder(), new PopupResolver());
        $this->preview_controller   = new PreviewController($this->popup_repository);
        $this->rest_registrar       = new RestRegistrar($this->popup_repository, $this->analytics_service, $this->import_export_service);
    }

    public static function instance(): self
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $this->booted = true;

        add_action('init', array($this, 'load_textdomain'));

        $this->popup_post_type->register_hooks();
        $this->popup_meta_registrar->register_hooks();
        $this->admin_menu->register_hooks();
        $this->assets->register_hooks();
        $this->preview_controller->register_hooks();
        $this->rest_registrar->register_hooks();
    }

    public function popup_repository(): PopupRepository
    {
        return $this->popup_repository;
    }

    public function load_textdomain(): void
    {
        load_plugin_textdomain(
            'legacy-popups',
            false,
            dirname(LEGACY_POPUPS_BASENAME) . '/languages'
        );
    }
}