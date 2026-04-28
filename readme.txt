=== LegacyPopups ===
Contributors: legacypopups
Tags: popup, modal, marketing, lead-generation
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Professional popup infrastructure for WordPress with a modular architecture.

== Description ==

LegacyPopups provides the technical foundation for a modular popup plugin.

This version includes:

* Plugin bootstrap and autoloading
* Activation and deactivation hooks
* A custom post type for popups
* Structured post meta registration for popup schemas and lifecycle state
* Popup entity and repository classes for domain-centric persistence
* A dedicated admin menu entry

== Installation ==

1. Upload the plugin folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the `Plugins` screen in WordPress.
3. Open `LegacyPopups` in the WordPress admin menu.

== Changelog ==

= 0.2.0 =
* Added structured popup data model, entity, meta registration and repository layer.

= 0.1.0 =
* Initial plugin scaffold.