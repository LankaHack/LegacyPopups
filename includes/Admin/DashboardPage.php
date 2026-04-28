<?php

declare(strict_types=1);

namespace LegacyPopups\Admin;

final class DashboardPage
{
    public function render(): void
    {
        ?>
        <div id="legacypopups-app" class="legacypopups-app-root" role="application">
            <div class="legacypopups-app-loading">
                <?php echo esc_html__('LegacyPopups Studio wird geladen…', 'legacy-popups'); ?>
            </div>
        </div>
        <?php
    }
}