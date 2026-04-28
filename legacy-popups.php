<?php
/**
 * Plugin Name: LegacyPopups
 * Plugin URI: https://example.com/legacy-popups
 * Description: Professional popup infrastructure for WordPress with a modular architecture.
 * Version: 0.2.0
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Author: LegacyPopups
 * Text Domain: legacy-popups
 * Domain Path: /languages
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

define('LEGACY_POPUPS_VERSION', '0.2.0');
define('LEGACY_POPUPS_FILE', __FILE__);
define('LEGACY_POPUPS_PATH', plugin_dir_path(__FILE__));
define('LEGACY_POPUPS_URL', plugin_dir_url(__FILE__));
define('LEGACY_POPUPS_BASENAME', plugin_basename(__FILE__));

require_once LEGACY_POPUPS_PATH . 'includes/Core/Autoloader.php';

LegacyPopups\Core\Autoloader::register();

register_activation_hook(LEGACY_POPUPS_FILE, array(LegacyPopups\Core\Activator::class, 'activate'));
register_deactivation_hook(LEGACY_POPUPS_FILE, array(LegacyPopups\Core\Deactivator::class, 'deactivate'));

function legacypopups(): LegacyPopups\Core\Plugin
{
    return LegacyPopups\Core\Plugin::instance();
}

add_action(
    'plugins_loaded',
    static function (): void {
        legacypopups()->boot();
    }
);