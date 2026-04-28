<?php

declare(strict_types=1);

define('LEGACY_POPUPS_PATH', dirname(__DIR__, 2) . DIRECTORY_SEPARATOR);
define('LEGACY_POPUPS_VERSION', '0.2.0-test');

require_once LEGACY_POPUPS_PATH . 'includes/Core/Autoloader.php';

LegacyPopups\Core\Autoloader::register();

function legacypopups_test_reset_wp_state(): void
{
    $GLOBALS['lp_wp_posts'] = array();
    $GLOBALS['lp_wp_meta'] = array();
    $GLOBALS['lp_wp_next_id'] = 1;
    $GLOBALS['lp_wp_modified_counter'] = 1;
}

legacypopups_test_reset_wp_state();

if (! class_exists('WP_Error')) {
    class WP_Error
    {
        private string $message;

        public function __construct(string $code = '', string $message = '')
        {
            $this->message = $message ?: $code;
        }

        public function get_error_message(): string
        {
            return $this->message;
        }
    }
}

if (! class_exists('WP_Post')) {
    class WP_Post
    {
        public int $ID;
        public string $post_type;
        public string $post_status;
        public string $post_title;

        public function __construct(array $data)
        {
            $this->ID = (int) ($data['ID'] ?? 0);
            $this->post_type = (string) ($data['post_type'] ?? 'post');
            $this->post_status = (string) ($data['post_status'] ?? 'draft');
            $this->post_title = (string) ($data['post_title'] ?? '');
        }
    }
}

if (! class_exists('WP_Query')) {
    class WP_Query
    {
        public array $posts = array();
        public int $found_posts = 0;
        public int $max_num_pages = 0;

        public function __construct(array $args = array())
        {
            $posts = array_values($GLOBALS['lp_wp_posts'] ?? array());
            $post_type = $args['post_type'] ?? '';
            $statuses = $args['post_status'] ?? array();
            $search = strtolower((string) ($args['s'] ?? ''));
            $meta_query = isset($args['meta_query']) && is_array($args['meta_query']) ? $args['meta_query'] : array();
            $per_page = max(1, (int) ($args['posts_per_page'] ?? 50));
            $page = max(1, (int) ($args['paged'] ?? 1));

            if (! is_array($statuses)) {
                $statuses = array($statuses);
            }

            $posts = array_values(array_filter($posts, static function (array $post) use ($post_type, $statuses, $search, $meta_query): bool {
                if ('' !== $post_type && ($post['post_type'] ?? '') !== $post_type) {
                    return false;
                }

                if (! empty($statuses) && ! in_array($post['post_status'] ?? '', $statuses, true)) {
                    return false;
                }

                if ('' !== $search && false === strpos(strtolower((string) ($post['post_title'] ?? '')), $search)) {
                    return false;
                }

                foreach ($meta_query as $condition) {
                    if (! is_array($condition) || ! isset($condition['key'])) {
                        continue;
                    }

                    $post_id = (int) ($post['ID'] ?? 0);
                    $value = $GLOBALS['lp_wp_meta'][$post_id][$condition['key']] ?? null;

                    if (array_key_exists('value', $condition) && $value !== $condition['value']) {
                        return false;
                    }
                }

                return true;
            }));

            usort($posts, static function (array $left, array $right): int {
                return (int) ($right['modified'] ?? 0) <=> (int) ($left['modified'] ?? 0);
            });

            $this->found_posts = count($posts);
            $this->max_num_pages = (int) ceil($this->found_posts / $per_page);
            $offset = ($page - 1) * $per_page;
            $posts = array_slice($posts, $offset, $per_page);

            $this->posts = array_map(static function (array $post): WP_Post {
                return new WP_Post($post);
            }, $posts);
        }
    }
}

if (! function_exists('__')) {
    function __($text, $domain = null): string
    {
        return (string) $text;
    }
}

if (! function_exists('apply_filters')) {
    function apply_filters($tag, $value)
    {
        return $value;
    }
}

if (! function_exists('absint')) {
    function absint($value): int
    {
        return abs((int) $value);
    }
}

if (! function_exists('sanitize_key')) {
    function sanitize_key($value): string
    {
        $value = strtolower((string) $value);

        return preg_replace('/[^a-z0-9_\-]/', '', $value) ?? '';
    }
}

if (! function_exists('sanitize_text_field')) {
    function sanitize_text_field($value): string
    {
        return trim(strip_tags((string) $value));
    }
}

if (! function_exists('sanitize_textarea_field')) {
    function sanitize_textarea_field($value): string
    {
        $value = str_replace("\r", '', (string) $value);

        return trim(strip_tags($value));
    }
}

if (! function_exists('sanitize_hex_color')) {
    function sanitize_hex_color($value): string
    {
        $value = strtolower(trim((string) $value));

        return preg_match('/^#[0-9a-f]{6}$/', $value) ? $value : '';
    }
}

if (! function_exists('esc_url_raw')) {
    function esc_url_raw($value): string
    {
        return trim((string) $value);
    }
}

if (! function_exists('home_url')) {
    function home_url($path = ''): string
    {
        $path = (string) $path;

        return 'https://example.test' . ($path !== '' ? $path : '');
    }
}

if (! function_exists('is_wp_error')) {
    function is_wp_error($value): bool
    {
        return $value instanceof WP_Error;
    }
}

if (! function_exists('wp_parse_url')) {
    function wp_parse_url($url, $component = -1)
    {
        return parse_url((string) $url, $component);
    }
}

if (! function_exists('get_post')) {
    function get_post($post_id)
    {
        $post_id = (int) $post_id;

        if (! isset($GLOBALS['lp_wp_posts'][$post_id])) {
            return null;
        }

        return new WP_Post($GLOBALS['lp_wp_posts'][$post_id]);
    }
}

if (! function_exists('wp_insert_post')) {
    function wp_insert_post($postarr, $wp_error = false)
    {
        $post_id = $GLOBALS['lp_wp_next_id']++;
        $GLOBALS['lp_wp_posts'][$post_id] = array(
            'ID' => $post_id,
            'post_type' => (string) ($postarr['post_type'] ?? 'post'),
            'post_title' => (string) ($postarr['post_title'] ?? ''),
            'post_status' => (string) ($postarr['post_status'] ?? 'draft'),
            'modified' => $GLOBALS['lp_wp_modified_counter']++,
        );

        return $post_id;
    }
}

if (! function_exists('wp_update_post')) {
    function wp_update_post($postarr, $wp_error = false)
    {
        $post_id = (int) ($postarr['ID'] ?? 0);

        if (! isset($GLOBALS['lp_wp_posts'][$post_id])) {
            return new WP_Error('missing_post', 'Missing post.');
        }

        $existing = $GLOBALS['lp_wp_posts'][$post_id];
        $GLOBALS['lp_wp_posts'][$post_id] = array_merge(
            $existing,
            array(
                'post_title' => (string) ($postarr['post_title'] ?? $existing['post_title']),
                'post_status' => (string) ($postarr['post_status'] ?? $existing['post_status']),
                'modified' => $GLOBALS['lp_wp_modified_counter']++,
            )
        );

        return $post_id;
    }
}

if (! function_exists('update_post_meta')) {
    function update_post_meta($post_id, $meta_key, $meta_value): bool
    {
        $post_id = (int) $post_id;

        if (! isset($GLOBALS['lp_wp_meta'][$post_id])) {
            $GLOBALS['lp_wp_meta'][$post_id] = array();
        }

        $GLOBALS['lp_wp_meta'][$post_id][$meta_key] = $meta_value;

        return true;
    }
}

if (! function_exists('get_post_meta')) {
    function get_post_meta($post_id, $meta_key = '', $single = false)
    {
        $post_id = (int) $post_id;
        $value = $GLOBALS['lp_wp_meta'][$post_id][$meta_key] ?? null;

        if ($single) {
            return $value ?? '';
        }

        return null === $value ? array() : array($value);
    }
}

if (! function_exists('wp_delete_post')) {
    function wp_delete_post($post_id, $force_delete = false)
    {
        $post = get_post($post_id);

        if (! $post instanceof WP_Post) {
            return null;
        }

        unset($GLOBALS['lp_wp_posts'][(int) $post_id], $GLOBALS['lp_wp_meta'][(int) $post_id]);

        return $post;
    }
}