/**
 * LegacyPopups - admin app shell.
 *
 * Renders a React shell using the WordPress-bundled wp.element runtime
 * and wires the popup list against the plugin REST API.
 */
(function (wp) {
    'use strict';

    if (!wp || !wp.element) {
        return;
    }

    var el = wp.element.createElement;
    var Fragment = wp.element.Fragment;
    var useEffect = wp.element.useEffect;
    var useRef = wp.element.useRef;
    var useState = wp.element.useState;
    var render = wp.element.render;
    var __ = (wp.i18n && wp.i18n.__) ? wp.i18n.__ : function (string) { return string; };
    var settings = window.LegacyPopupsAdmin || {};

    var NAV_ITEMS = [
        { id: 'dashboard', label: __('Dashboard', 'legacy-popups'), icon: 'dashboard' },
        { id: 'popups', label: __('Popups', 'legacy-popups'), icon: 'list' },
        { id: 'builder', label: __('Builder', 'legacy-popups'), icon: 'builder' },
        { id: 'stats', label: __('Statistik', 'legacy-popups'), icon: 'stats' },
        { id: 'settings', label: __('Einstellungen', 'legacy-popups'), icon: 'settings' }
    ];

    var TOPBAR = {
        dashboard: {
            title: __('Dashboard', 'legacy-popups'),
            subtitle: __('Aktive Kampagnen, Conversion-Trends und Quick Actions auf einen Blick.', 'legacy-popups')
        },
        popups: {
            title: __('Popups', 'legacy-popups'),
            subtitle: __('Suche, filtere und verwalte Status, Vorschau und Duplikate zentral.', 'legacy-popups')
        },
        builder: {
            title: __('Builder', 'legacy-popups'),
            subtitle: __('Visueller Editor mit Live-Vorschau, Komponenten und Design-Presets.', 'legacy-popups')
        },
        stats: {
            title: __('Statistik', 'legacy-popups'),
            subtitle: __('Impressionen, Klicks, Conversions und Vergleichszeitraeume.', 'legacy-popups')
        },
        settings: {
            title: __('Einstellungen', 'legacy-popups'),
            subtitle: __('Globale Optionen fuer Tracking, Datenschutz und Performance.', 'legacy-popups')
        }
    };

    var STATUS_OPTIONS = [
        { value: '', label: __('Alle', 'legacy-popups') },
        { value: 'active', label: __('Aktiv', 'legacy-popups') },
        { value: 'draft', label: __('Entwurf', 'legacy-popups') },
        { value: 'paused', label: __('Pausiert', 'legacy-popups') },
        { value: 'planned', label: __('Geplant', 'legacy-popups') },
        { value: 'archived', label: __('Archiviert', 'legacy-popups') }
    ];

    function classNames(items) {
        return items.filter(Boolean).join(' ');
    }

    function buildQuery(params) {
        var query = new URLSearchParams();

        Object.keys(params || {}).forEach(function (key) {
            if (params[key] !== '' && params[key] !== null && typeof params[key] !== 'undefined') {
                query.append(key, params[key]);
            }
        });

        return query.toString();
    }

    function getErrorMessage(payload, fallback) {
        if (payload && typeof payload.message === 'string' && payload.message) {
            return payload.message;
        }

        return fallback;
    }

    function apiRequest(path, options) {
        var requestOptions = options || {};
        var url = (settings.restUrl || '').replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        var headers = Object.assign(
            {
                'X-WP-Nonce': settings.nonce || '',
                'Accept': 'application/json'
            },
            requestOptions.headers || {}
        );

        if (requestOptions.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        return window.fetch(url, {
            method: requestOptions.method || 'GET',
            credentials: 'same-origin',
            headers: headers,
            body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
        }).then(function (response) {
            if (!response.ok) {
                return response.json().catch(function () {
                    return {};
                }).then(function (payload) {
                    throw new Error(getErrorMessage(payload, __('Die Anfrage konnte nicht verarbeitet werden.', 'legacy-popups')));
                });
            }

            return response.json();
        });
    }

    var PopupApi = {
        list: function (filters) {
            var query = buildQuery({
                search: filters.search,
                popup_status: filters.popupStatus,
                per_page: 50,
                page: 1
            });

            return apiRequest('popups' + (query ? '?' + query : ''));
        },
        get: function (popupId) {
            return apiRequest('popups/' + popupId);
        },
        create: function (payload) {
            return apiRequest('popups', {
                method: 'POST',
                body: payload
            });
        },
        update: function (popupId, payload) {
            return apiRequest('popups/' + popupId, {
                method: 'POST',
                body: payload
            });
        },
        duplicate: function (popupId) {
            return apiRequest('popups/' + popupId + '/duplicate', {
                method: 'POST'
            });
        },
        remove: function (popupId) {
            return apiRequest('popups/' + popupId, {
                method: 'DELETE'
            });
        }
    };

    var AnalyticsApi = {
        summary: function (popupId, from, to) {
            var query = buildQuery({ from: from, to: to });
            return apiRequest('analytics/summary/' + popupId + (query ? '?' + query : ''));
        }
    };

    var ImportExportApi = {
        exportPopup: function (popupId) {
            return apiRequest('export/' + popupId, {
                method: 'POST'
            });
        },
        importPopup: function (document) {
            return apiRequest('import', {
                method: 'POST',
                body: document
            });
        }
    };

    function pad2(value) {
        var str = String(value);
        return str.length < 2 ? '0' + str : str;
    }

    function toIsoDate(date) {
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }

    function parseIsoDate(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        var parts = value.split('-');
        if (parts.length !== 3) {
            return null;
        }
        var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return window.isNaN(d.getTime()) ? null : d;
    }

    function rangeForPreset(preset) {
        var to = new Date();
        to.setHours(0, 0, 0, 0);
        var from = new Date(to);

        switch (preset) {
            case 'today':
                break;
            case '7d':
                from.setDate(from.getDate() - 6);
                break;
            case '90d':
                from.setDate(from.getDate() - 89);
                break;
            case '30d':
            default:
                from.setDate(from.getDate() - 29);
                break;
        }

        return { from: toIsoDate(from), to: toIsoDate(to) };
    }

    function enumerateDays(fromIso, toIso) {
        var start = parseIsoDate(fromIso);
        var end = parseIsoDate(toIso);
        var out = [];
        if (!start || !end || start > end) {
            return out;
        }
        var cursor = new Date(start);
        while (cursor <= end) {
            out.push(toIsoDate(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return out;
    }

    function formatNumber(value) {
        var n = Number(value || 0);
        if (!isFinite(n)) {
            return '0';
        }
        try {
            return new Intl.NumberFormat(settings.locale || 'de-DE').format(n);
        } catch (e) {
            return String(Math.round(n));
        }
    }

    function formatPercent(value, fractionDigits) {
        var n = Number(value || 0);
        if (!isFinite(n)) {
            n = 0;
        }
        var digits = typeof fractionDigits === 'number' ? fractionDigits : 1;
        try {
            return new Intl.NumberFormat(settings.locale || 'de-DE', {
                style: 'percent',
                minimumFractionDigits: digits,
                maximumFractionDigits: digits
            }).format(n);
        } catch (e) {
            return (n * 100).toFixed(digits) + ' %';
        }
    }

    function formatShortDate(iso) {
        var d = parseIsoDate(iso);
        if (!d) {
            return iso || '';
        }
        try {
            return new Intl.DateTimeFormat(settings.locale || 'de-DE', { day: '2-digit', month: '2-digit' }).format(d);
        } catch (e) {
            return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1);
        }
    }

    function safeRate(numerator, denominator) {
        var n = Number(numerator || 0);
        var d = Number(denominator || 0);
        if (!d) {
            return 0;
        }
        return n / d;
    }

    function buildExportFilename(document, popup) {
        var title = '';

        if (document && document.popup && typeof document.popup.title === 'string') {
            title = document.popup.title;
        } else if (popup && typeof popup.title === 'string') {
            title = popup.title;
        }

        title = String(title || 'legacy-popup')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'legacy-popup';

        return title + '.json';
    }

    function downloadJsonFile(filename, data) {
        var blob = new window.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var url = window.URL.createObjectURL(blob);
        var link = document.createElement('a');

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.setTimeout(function () {
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    function readJsonFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) {
                reject(new Error(__('Keine Importdatei ausgewaehlt.', 'legacy-popups')));
                return;
            }

            var reader = new window.FileReader();

            reader.onerror = function () {
                reject(new Error(__('Die Importdatei konnte nicht gelesen werden.', 'legacy-popups')));
            };

            reader.onload = function () {
                try {
                    resolve(JSON.parse(String(reader.result || '{}')));
                } catch (error) {
                    reject(new Error(__('Die Importdatei enthaelt kein gueltiges JSON.', 'legacy-popups')));
                }
            };

            reader.readAsText(file);
        });
    }

    function useDebouncedValue(value, delay) {
        var state = useState(value);
        var debouncedValue = state[0];
        var setDebouncedValue = state[1];

        useEffect(function () {
            var timeout = window.setTimeout(function () {
                setDebouncedValue(value);
            }, delay);

            return function () {
                window.clearTimeout(timeout);
            };
        }, [value, delay]);

        return debouncedValue;
    }

    function formatPopupStatus(status) {
        var labels = {
            active: __('Aktiv', 'legacy-popups'),
            draft: __('Entwurf', 'legacy-popups'),
            paused: __('Pausiert', 'legacy-popups'),
            planned: __('Geplant', 'legacy-popups'),
            archived: __('Archiviert', 'legacy-popups')
        };

        return labels[status] || status || __('Unbekannt', 'legacy-popups');
    }

    function formatModifiedDate(dateString) {
        if (!dateString) {
            return '—';
        }

        var normalized = dateString.replace(' ', 'T');
        var date = new Date(normalized);

        if (window.isNaN(date.getTime())) {
            return dateString;
        }

        try {
            return new Intl.DateTimeFormat(settings.locale || 'de-DE', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        } catch (error) {
            return dateString;
        }
    }

    function usePopupCollection() {
        var itemsState = useState([]);
        var items = itemsState[0];
        var setItems = itemsState[1];

        var metaState = useState({ total: 0, total_pages: 1, page: 1, per_page: 50 });
        var meta = metaState[0];
        var setMeta = metaState[1];

        var filtersState = useState({ search: '', popupStatus: '' });
        var filters = filtersState[0];
        var setFilters = filtersState[1];

        var loadingState = useState(true);
        var isLoading = loadingState[0];
        var setIsLoading = loadingState[1];

        var refreshingState = useState(false);
        var isRefreshing = refreshingState[0];
        var setIsRefreshing = refreshingState[1];

        var creatingState = useState(false);
        var isCreating = creatingState[0];
        var setIsCreating = creatingState[1];

        var importingState = useState(false);
        var isImporting = importingState[0];
        var setIsImporting = importingState[1];

        var errorState = useState('');
        var errorMessage = errorState[0];
        var setErrorMessage = errorState[1];

        var noticeState = useState('');
        var noticeMessage = noticeState[0];
        var setNoticeMessage = noticeState[1];

        var busyState = useState({});
        var busyMap = busyState[0];
        var setBusyMap = busyState[1];

        var totalCountState = useState(0);
        var totalCount = totalCountState[0];
        var setTotalCount = totalCountState[1];

        var reloadState = useState(0);
        var reloadKey = reloadState[0];
        var setReloadKey = reloadState[1];

        var debouncedSearch = useDebouncedValue(filters.search, 250);

        function setSearch(nextSearch) {
            setFilters(function (previous) {
                return Object.assign({}, previous, { search: nextSearch });
            });
        }

        function setPopupStatus(nextStatus) {
            setFilters(function (previous) {
                return Object.assign({}, previous, { popupStatus: nextStatus });
            });
        }

        function refreshList(background) {
            var nextFilters = {
                search: debouncedSearch,
                popupStatus: filters.popupStatus
            };

            if (background) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            setErrorMessage('');

            return PopupApi.list(nextFilters).then(function (payload) {
                var nextItems = Array.isArray(payload.items) ? payload.items : [];
                var nextMeta = payload.meta || { total: nextItems.length, total_pages: 1, page: 1, per_page: 50 };

                setItems(nextItems);
                setMeta(nextMeta);

                if (!nextFilters.search && !nextFilters.popupStatus) {
                    setTotalCount(nextMeta.total || nextItems.length);
                }
            }).catch(function (error) {
                setErrorMessage(error.message || __('Die Popup-Liste konnte nicht geladen werden.', 'legacy-popups'));
            }).finally(function () {
                setIsLoading(false);
                setIsRefreshing(false);
            });
        }

        useEffect(function () {
            refreshList(false);
        }, [debouncedSearch, filters.popupStatus, reloadKey]);

        function markBusy(popupId, isBusy) {
            setBusyMap(function (previous) {
                var next = Object.assign({}, previous);

                if (isBusy) {
                    next[popupId] = true;
                } else {
                    delete next[popupId];
                }

                return next;
            });
        }

        function reload() {
            setReloadKey(function (value) {
                return value + 1;
            });
        }

        function runPopupAction(popupId, action, successMessage) {
            markBusy(popupId, true);
            setErrorMessage('');

            return action().then(function () {
                if (successMessage) {
                    setNoticeMessage(successMessage);
                }

                reload();
            }).catch(function (error) {
                setErrorMessage(error.message || __('Die Aktion konnte nicht abgeschlossen werden.', 'legacy-popups'));
            }).finally(function () {
                markBusy(popupId, false);
            });
        }

        function createPopup() {
            setIsCreating(true);
            setErrorMessage('');
            setNoticeMessage('');
            setFilters({ search: '', popupStatus: '' });

            return PopupApi.create({
                title: __('Neues Popup', 'legacy-popups')
            }).then(function (popup) {
                setNoticeMessage(__('Popup wurde erstellt.', 'legacy-popups'));
                reload();
                return popup;
            }).catch(function (error) {
                setErrorMessage(error.message || __('Das Popup konnte nicht erstellt werden.', 'legacy-popups'));
                return null;
            }).finally(function () {
                setIsCreating(false);
            });
        }

        function togglePopupStatus(popup) {
            var nextStatus = popup.popup_status === 'active' ? 'paused' : 'active';
            var successMessage = nextStatus === 'active'
                ? __('Popup wurde aktiviert.', 'legacy-popups')
                : __('Popup wurde pausiert.', 'legacy-popups');

            return runPopupAction(popup.id, function () {
                return PopupApi.update(popup.id, { popup_status: nextStatus });
            }, successMessage);
        }

        function duplicatePopup(popup) {
            return runPopupAction(popup.id, function () {
                return PopupApi.duplicate(popup.id);
            }, __('Popup wurde dupliziert.', 'legacy-popups'));
        }

        function deletePopup(popup) {
            if (!window.confirm(__('Dieses Popup wirklich dauerhaft loeschen?', 'legacy-popups'))) {
                return Promise.resolve();
            }

            return runPopupAction(popup.id, function () {
                return PopupApi.remove(popup.id);
            }, __('Popup wurde geloescht.', 'legacy-popups'));
        }

        function previewPopup(popup) {
            var url = popup.preview_url || popup.edit_url;

            if (!url) {
                setErrorMessage(__('Fuer dieses Popup ist noch keine Vorschau verfuegbar.', 'legacy-popups'));
                return;
            }

            window.open(url, '_blank', 'noopener');
        }

        function exportPopup(popup) {
            markBusy(popup.id, true);
            setErrorMessage('');
            setNoticeMessage('');

            return ImportExportApi.exportPopup(popup.id).then(function (document) {
                downloadJsonFile(buildExportFilename(document, popup), document);
                setNoticeMessage(__('Popup wurde exportiert.', 'legacy-popups'));
                return document;
            }).catch(function (error) {
                setErrorMessage(error.message || __('Das Popup konnte nicht exportiert werden.', 'legacy-popups'));
                return null;
            }).finally(function () {
                markBusy(popup.id, false);
            });
        }

        function importPopupFile(file) {
            setIsImporting(true);
            setErrorMessage('');
            setNoticeMessage('');

            return readJsonFile(file).then(function (document) {
                return ImportExportApi.importPopup(document);
            }).then(function (response) {
                setNoticeMessage(__('Popup wurde importiert und als Entwurf angelegt.', 'legacy-popups'));
                reload();
                return response && response.popup ? response.popup : null;
            }).catch(function (error) {
                setErrorMessage(error.message || __('Das Popup konnte nicht importiert werden.', 'legacy-popups'));
                return null;
            }).finally(function () {
                setIsImporting(false);
            });
        }

        function dismissMessage() {
            setErrorMessage('');
            setNoticeMessage('');
        }

        return {
            items: items,
            meta: meta,
            filters: filters,
            isLoading: isLoading,
            isRefreshing: isRefreshing,
            isCreating: isCreating,
            isImporting: isImporting,
            errorMessage: errorMessage,
            noticeMessage: noticeMessage,
            busyMap: busyMap,
            totalCount: totalCount,
            setSearch: setSearch,
            setPopupStatus: setPopupStatus,
            createPopup: createPopup,
            togglePopupStatus: togglePopupStatus,
            duplicatePopup: duplicatePopup,
            deletePopup: deletePopup,
            previewPopup: previewPopup,
            exportPopup: exportPopup,
            importPopupFile: importPopupFile,
            dismissMessage: dismissMessage,
            refresh: function () {
                return refreshList(true);
            }
        };
    }

    function Icon(props) {
        var paths = {
            dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
            list: 'M4 6h16M4 12h16M4 18h16',
            builder: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
            stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
            settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 4a7.96 7.96 0 00-.2-1.74l2.1-1.65-2-3.46-2.49 1a7.97 7.97 0 00-3-1.74L15 1h-4l-.35 2.41a7.97 7.97 0 00-3 1.74l-2.49-1-2 3.46 2.1 1.65A7.96 7.96 0 003.06 12c0 .59.07 1.17.2 1.74L1.16 15.4l2 3.46 2.49-1c.88.78 1.9 1.38 3 1.74L9 22h4l.35-2.41c1.1-.36 2.12-.96 3-1.74l2.49 1 2-3.46-2.1-1.65c.13-.57.2-1.15.2-1.74z',
            plus: 'M12 5v14M5 12h14',
            sparkles: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z',
            search: 'M11 4a7 7 0 105.29 11.59l3.56 3.56 1.41-1.41-3.56-3.56A7 7 0 0011 4z',
            refresh: 'M20 12a8 8 0 00-13.66-5.66M4 12a8 8 0 0013.66 5.66M4 4v4h4M20 20v-4h-4',
            download: 'M12 3v11M8 10l4 4 4-4M5 19h14',
            upload: 'M12 21V10M8 14l4-4 4 4M5 5h14',
            eye: 'M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12zm10.5 4a4 4 0 100-8 4 4 0 000 8z',
            duplicate: 'M9 9h11v11H9zM4 4h11v11H4z',
            trash: 'M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13',
            close: 'M6 6l12 12M18 6L6 18',
            text: 'M4 6h16M4 10h12M4 14h16M4 18h10',
            image: 'M21 16V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2zm-5-4a2 2 0 11-4 0 2 2 0 014 0zm-9 4l3.5-5 3 4 2-2.5L20 20H4l3-4z',
            button: 'M4 9h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm4 3h8',
            spacer: 'M8 12h8M12 8v8M3 8V4m0 0h4M3 4l4 4M21 8V4m0 0h-4m4 0l-4 4M3 16v4m0 0h4m-4 0l4-4M21 16v4m0 0h-4m4 0l-4-4',
            container: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z',
            move: 'M12 2l3 3-3 3M12 22l-3-3 3-3M2 12l3-3-3-3M22 12l-3 3 3 3M12 12v.01',
            undo: 'M9 14L4 9l5-5M4 9h10a7 7 0 010 14h-1',
            desktop: 'M20 16H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2zm-8 2v2m-4 0h8',
            tablet: 'M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm5 14h.01',
            mobile: 'M12 18h.01M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z'
        };
        var stroke = props.stroke;
        var d = paths[props.name] || '';

        return el('svg', {
            className: classNames(['lp-nav__icon', props.className || '']),
            width: props.size || 18,
            height: props.size || 18,
            viewBox: '0 0 24 24',
            fill: stroke ? 'none' : 'currentColor',
            stroke: stroke ? 'currentColor' : 'none',
            strokeWidth: stroke ? 1.8 : 0,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true
        }, el('path', { d: d }));
    }

    function Sidebar(props) {
        var version = settings.version || '0.2.0';

        return el('aside', { className: 'lp-sidebar' },
            el('div', { className: 'lp-brand' },
                el('div', { className: 'lp-brand__mark' }, 'LP'),
                el('div', null,
                    el('p', { className: 'lp-brand__title' }, 'LegacyPopups'),
                    el('p', { className: 'lp-brand__subtitle' }, __('Studio', 'legacy-popups'))
                )
            ),
            el('nav', { className: 'lp-nav', 'aria-label': __('Hauptnavigation', 'legacy-popups') },
                el('div', { className: 'lp-nav__group-label' }, __('Workspace', 'legacy-popups')),
                NAV_ITEMS.map(function (item) {
                    var isActive = props.active === item.id;
                    var badge = item.id === 'popups' ? String(props.popupCount || 0) : '';

                    return el('button', {
                        key: item.id,
                        type: 'button',
                        className: 'lp-nav__item' + (isActive ? ' is-active' : ''),
                        onClick: function () {
                            props.onSelect(item.id);
                        }
                    },
                        el(Icon, { name: item.icon, stroke: true }),
                        el('span', null, item.label),
                        item.id === 'popups' ? el('span', { className: 'lp-nav__badge' }, badge) : null
                    );
                })
            ),
            el('div', { className: 'lp-sidebar__footer' },
                el('span', null, __('Version', 'legacy-popups')),
                el('span', { className: 'lp-version-pill' }, 'v' + version)
            )
        );
    }

    function Topbar(props) {
        var info = TOPBAR[props.active] || TOPBAR.dashboard;

        return el('header', { className: 'lp-topbar' },
            el('div', null,
                el('h1', { className: 'lp-topbar__title' }, info.title),
                el('p', { className: 'lp-topbar__subtitle' }, info.subtitle)
            ),
            el('div', { className: 'lp-topbar__actions' },
                props.active === 'popups'
                    ? el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--ghost',
                        disabled: props.isRefreshing,
                        onClick: props.onRefreshPopups
                    },
                        el(Icon, { name: 'refresh', stroke: true, size: 16 }),
                        props.isRefreshing ? __('Lade…', 'legacy-popups') : __('Aktualisieren', 'legacy-popups')
                    )
                    : el('button', { type: 'button', className: 'lp-btn lp-btn--ghost' },
                        el(Icon, { name: 'sparkles', stroke: true, size: 16 }),
                        __('Vorlagen', 'legacy-popups')
                    ),
                el('button', {
                    type: 'button',
                    className: 'lp-btn lp-btn--primary',
                    disabled: props.isCreating,
                    onClick: props.onCreatePopup
                },
                    el(Icon, { name: 'plus', stroke: true, size: 16 }),
                    props.isCreating ? __('Erstelle…', 'legacy-popups') : __('Neues Popup', 'legacy-popups')
                )
            )
        );
    }

    function Metric(props) {
        return el('div', { className: 'lp-metric' },
            el('span', { className: 'lp-metric__label' }, props.label),
            el('span', { className: 'lp-metric__value' }, props.value),
            props.delta ? el('span', { className: 'lp-metric__delta' + (props.deltaDown ? ' is-down' : '') }, props.delta) : null
        );
    }

    function Notice(props) {
        if (!props.message) {
            return null;
        }

        return el('div', {
            className: classNames(['lp-notice', props.variant === 'error' ? 'is-error' : 'is-success'])
        },
            el('span', { className: 'lp-notice__message' }, props.message),
            el('button', {
                type: 'button',
                className: 'lp-notice__dismiss',
                onClick: props.onDismiss,
                'aria-label': __('Hinweis schliessen', 'legacy-popups')
            }, el(Icon, { name: 'close', stroke: true, size: 14 }))
        );
    }

    function StatusBadge(props) {
        return el('span', {
            className: classNames(['lp-status', 'lp-status--' + (props.status || 'draft')])
        }, formatPopupStatus(props.status));
    }

    function DashboardView(props) {
        return el(Fragment, null,
            el('section', { className: 'lp-hero' },
                el('div', null,
                    el('p', { className: 'lp-hero__eyebrow' }, __('Willkommen', 'legacy-popups')),
                    el('h2', { className: 'lp-hero__title' }, __('Baue Popups, die wie ein Produkt wirken.', 'legacy-popups')),
                    el('p', { className: 'lp-hero__lede' }, __('Die Popup-Liste ist jetzt live an die REST-API gebunden. Erstelle, dupliziere und schalte Kampagnen direkt aus dem Studio.', 'legacy-popups')),
                    el('div', { className: 'lp-hero__actions' },
                        el('button', {
                            className: 'lp-btn lp-btn--primary',
                            type: 'button',
                            onClick: props.onCreatePopup,
                            disabled: props.isCreating
                        },
                            el(Icon, { name: 'plus', stroke: true, size: 16 }),
                            __('Popup anlegen', 'legacy-popups')
                        ),
                        el('button', {
                            className: 'lp-btn lp-btn--ghost',
                            type: 'button',
                            onClick: props.onOpenPopups
                        }, __('Zur Popup-Liste', 'legacy-popups'))
                    )
                ),
                el('div', { className: 'lp-hero__visual' },
                    el('div', { className: 'lp-hero__mock' },
                        el('div', { className: 'lp-hero__mock-bar lp-hero__mock-bar--accent' }),
                        el('div', { className: 'lp-hero__mock-bar lp-hero__mock-bar--wide' }),
                        el('div', { className: 'lp-hero__mock-bar lp-hero__mock-bar--med' }),
                        el('div', { className: 'lp-hero__mock-bar lp-hero__mock-bar--med' }),
                        el('div', { className: 'lp-hero__mock-cta' })
                    )
                )
            ),
            el('div', { className: 'lp-grid lp-grid--metrics' },
                el(Metric, { label: __('Gesamtzahl Popups', 'legacy-popups'), value: String(props.totalPopups || 0), delta: __('Live aus der API', 'legacy-popups') }),
                el(Metric, { label: __('Impressionen 7T', 'legacy-popups'), value: '—' }),
                el(Metric, { label: __('Conversion-Rate', 'legacy-popups'), value: '—' }),
                el(Metric, { label: __('Letzte Aktivitaet', 'legacy-popups'), value: props.totalPopups > 0 ? __('In Verwaltung', 'legacy-popups') : __('Noch leer', 'legacy-popups') })
            ),
            el('div', { className: 'lp-section-grid', style: { marginTop: 24 } },
                el('div', { className: 'lp-panel' },
                    el('div', { className: 'lp-panel__header' },
                        el('div', null,
                            el('h3', { className: 'lp-panel__title' }, __('Status der Arbeitsflaeche', 'legacy-popups')),
                            el('p', { className: 'lp-panel__hint' }, __('Die Popup-Liste, Statuswechsel und Duplikate sind bereits angebunden.', 'legacy-popups'))
                        )
                    ),
                    el('div', { className: 'lp-empty lp-empty--compact' },
                        el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'list', stroke: true, size: 28 })),
                        el('p', { className: 'lp-empty__title' }, __('Naechster Schritt: Builder', 'legacy-popups')),
                        el('p', { className: 'lp-empty__lede' }, __('Die Liste arbeitet bereits produktiv. Als naechstes folgt der visuelle Editor fuer Inhalte und Layout.', 'legacy-popups'))
                    )
                ),
                el('div', { className: 'lp-panel' },
                    el('div', { className: 'lp-panel__header' },
                        el('div', null,
                            el('h3', { className: 'lp-panel__title' }, __('Quick Actions', 'legacy-popups')),
                            el('p', { className: 'lp-panel__hint' }, __('Direktzugriffe in den aktuellen Workflow.', 'legacy-popups'))
                        )
                    ),
                    el('div', { className: 'lp-stack' },
                        el('button', { type: 'button', className: 'lp-btn lp-btn--ghost lp-btn--full', onClick: props.onOpenPopups }, __('Popup-Liste oeffnen', 'legacy-popups')),
                        el('button', { type: 'button', className: 'lp-btn lp-btn--ghost lp-btn--full', onClick: props.onCreatePopup }, __('Neues Popup anlegen', 'legacy-popups')),
                        el('button', { type: 'button', className: 'lp-btn lp-btn--ghost lp-btn--full' }, __('Tracking spaeter konfigurieren', 'legacy-popups'))
                    )
                )
            )
        );
    }

    function PopupRow(props) {
        var popup = props.popup;
        var isBusy = !!props.isBusy;

        return el('tr', null,
            el('td', null,
                el('div', { className: 'lp-table__title-cell' },
                    el('span', { className: 'lp-table__title' }, popup.title || __('Unbenanntes Popup', 'legacy-popups')),
                    el('span', { className: 'lp-table__meta' }, '#' + popup.id)
                )
            ),
            el('td', null, el(StatusBadge, { status: popup.popup_status })),
            el('td', null,
                el('div', { className: 'lp-table__title-cell' },
                    el('span', { className: 'lp-table__title' }, formatModifiedDate(popup.modified_human)),
                    el('span', { className: 'lp-table__meta' }, popup.post_status || 'draft')
                )
            ),
            el('td', null,
                el('div', { className: 'lp-table__actions' },
                    el('button', {
                        type: 'button',
                        className: 'lp-action-btn',
                        disabled: isBusy,
                        onClick: function () { props.onToggleStatus(popup); }
                    }, popup.popup_status === 'active' ? __('Deaktivieren', 'legacy-popups') : __('Aktivieren', 'legacy-popups')),
                    el('button', {
                        type: 'button',
                        className: 'lp-action-btn',
                        disabled: isBusy,
                        onClick: function () { props.onDuplicate(popup); }
                    },
                        el(Icon, { name: 'duplicate', stroke: true, size: 14 }),
                        __('Duplizieren', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-action-btn',
                        disabled: isBusy || (!popup.preview_url && !popup.edit_url),
                        onClick: function () { props.onPreview(popup); }
                    },
                        el(Icon, { name: 'eye', stroke: true, size: 14 }),
                        __('Vorschau', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-action-btn',
                        disabled: isBusy,
                        onClick: function () { props.onExport(popup); }
                    },
                        el(Icon, { name: 'download', stroke: true, size: 14 }),
                        __('Export', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-action-btn lp-action-btn--danger',
                        disabled: isBusy,
                        onClick: function () { props.onDelete(popup); }
                    },
                        el(Icon, { name: 'trash', stroke: true, size: 14 }),
                        __('Loeschen', 'legacy-popups')
                    )
                )
            )
        );
    }

    function PopupsView(props) {
        var popupState = props.popupState;
        var items = popupState.items;
        var noResults = !popupState.isLoading && items.length === 0;
        var importInputRef = useRef(null);

        function openImportDialog() {
            if (!importInputRef.current) {
                return;
            }

            importInputRef.current.value = '';
            importInputRef.current.click();
        }

        function handleImportChange(event) {
            var file = event.target.files && event.target.files[0] ? event.target.files[0] : null;

            popupState.importPopupFile(file).finally(function () {
                if (importInputRef.current) {
                    importInputRef.current.value = '';
                }
            });
        }

        return el(Fragment, null,
            el(Notice, {
                message: popupState.errorMessage,
                variant: 'error',
                onDismiss: popupState.dismissMessage
            }),
            el(Notice, {
                message: popupState.noticeMessage,
                variant: 'success',
                onDismiss: popupState.dismissMessage
            }),
            el('div', { className: 'lp-panel' },
                el('div', { className: 'lp-panel__header' },
                    el('div', null,
                        el('h3', { className: 'lp-panel__title' }, __('Alle Popups', 'legacy-popups')),
                        el('p', { className: 'lp-panel__hint' }, __('Suche, filtere und verwalte saemtliche Popups ueber die REST-API.', 'legacy-popups'))
                    ),
                    el('div', { className: 'lp-panel__meta' },
                        el('span', { className: 'lp-panel__count' }, String(popupState.meta.total || items.length)),
                        el('span', { className: 'lp-panel__count-label' }, __('Treffer', 'legacy-popups'))
                    )
                ),
                el('div', { className: 'lp-toolbar' },
                    el('label', { className: 'lp-search', htmlFor: 'lp-popup-search' },
                        el(Icon, { name: 'search', stroke: true, size: 16, className: 'lp-search__icon' }),
                        el('input', {
                            id: 'lp-popup-search',
                            className: 'lp-search__input',
                            type: 'search',
                            value: popupState.filters.search,
                            placeholder: __('Popups durchsuchen…', 'legacy-popups'),
                            onChange: function (event) {
                                popupState.setSearch(event.target.value);
                            }
                        })
                    ),
                    el('div', { className: 'lp-segmented', role: 'tablist', 'aria-label': __('Statusfilter', 'legacy-popups') },
                        STATUS_OPTIONS.map(function (option) {
                            var isActive = popupState.filters.popupStatus === option.value;

                            return el('button', {
                                key: option.value || 'all',
                                type: 'button',
                                role: 'tab',
                                'aria-selected': isActive,
                                className: classNames(['lp-segmented__button', isActive ? 'is-active' : '']),
                                onClick: function () {
                                    popupState.setPopupStatus(option.value);
                                }
                            }, option.label);
                        })
                    ),
                    el('div', { style: { display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
                        el('input', {
                            ref: importInputRef,
                            type: 'file',
                            accept: 'application/json,.json',
                            style: { display: 'none' },
                            onChange: handleImportChange
                        }),
                        el('button', {
                            type: 'button',
                            className: 'lp-btn lp-btn--ghost',
                            disabled: popupState.isImporting,
                            onClick: openImportDialog
                        },
                            el(Icon, { name: 'upload', stroke: true, size: 14 }),
                            popupState.isImporting ? __('Importiere…', 'legacy-popups') : __('JSON importieren', 'legacy-popups')
                        )
                    )
                ),
                popupState.isLoading && items.length === 0
                    ? el('div', { className: 'lp-empty lp-empty--compact' },
                        el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'refresh', stroke: true, size: 28 })),
                        el('p', { className: 'lp-empty__title' }, __('Popups werden geladen', 'legacy-popups')),
                        el('p', { className: 'lp-empty__lede' }, __('Die Liste wird gerade mit den aktuellen Daten synchronisiert.', 'legacy-popups'))
                    )
                    : null,
                noResults
                    ? el('div', { className: 'lp-empty' },
                        el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'list', stroke: true, size: 28 })),
                        el('p', { className: 'lp-empty__title' }, popupState.filters.search || popupState.filters.popupStatus ? __('Keine passenden Popups', 'legacy-popups') : __('Noch keine Popups angelegt', 'legacy-popups')),
                        el('p', { className: 'lp-empty__lede' }, popupState.filters.search || popupState.filters.popupStatus
                            ? __('Passe Suche oder Statusfilter an, um weitere Ergebnisse anzuzeigen.', 'legacy-popups')
                            : __('Lege dein erstes Popup an und steuere Status, Vorschau und Duplikate direkt aus dieser Liste.', 'legacy-popups')),
                        !popupState.filters.search && !popupState.filters.popupStatus
                            ? el('button', {
                                type: 'button',
                                className: 'lp-btn lp-btn--primary',
                                onClick: props.onCreatePopup,
                                disabled: popupState.isCreating
                            },
                                el(Icon, { name: 'plus', stroke: true, size: 16 }),
                                __('Popup erstellen', 'legacy-popups')
                            )
                            : null
                    )
                    : null,
                items.length > 0
                    ? el('div', { className: 'lp-table-wrapper' },
                        el('table', { className: 'lp-table' },
                            el('thead', null,
                                el('tr', null,
                                    el('th', null, __('Popup', 'legacy-popups')),
                                    el('th', null, __('Status', 'legacy-popups')),
                                    el('th', null, __('Zuletzt geaendert', 'legacy-popups')),
                                    el('th', null, __('Aktionen', 'legacy-popups'))
                                )
                            ),
                            el('tbody', null,
                                items.map(function (popup) {
                                    return el(PopupRow, {
                                        key: popup.id,
                                        popup: popup,
                                        isBusy: popupState.busyMap[popup.id],
                                        onToggleStatus: popupState.togglePopupStatus,
                                        onDuplicate: popupState.duplicatePopup,
                                        onPreview: popupState.previewPopup,
                                        onExport: popupState.exportPopup,
                                        onDelete: popupState.deletePopup
                                    });
                                })
                            )
                        )
                    )
                    : null
            )
        );
    }

    // ─── Builder ───────────────────────────────────────────────────────────

    var BUILDER_SCHEMA_VERSION = 1;
    var DEFAULT_BUILDER_LAYOUT = {
        width: 540,
        position: 'center',
        overlay: true,
        background: '#ffffff',
        borderRadius: 18,
        padding: 36,
        shadow: 'md',
        overlayColor: '#000000',
        overlayOpacity: 50,
        animation: 'fade'
    };

    var DEFAULT_BUILDER_NODES = [
        { id: 'node-title', type: 'text', props: { content: 'Deine Ueberschrift', fontSize: 28, fontWeight: 700, color: '#1a1a1d', align: 'center' } },
        { id: 'node-body', type: 'text', props: { content: 'Hier steht dein Angebot oder Hinweis.', fontSize: 15, fontWeight: 400, color: '#6b6457', align: 'center' } },
        { id: 'node-cta', type: 'button', props: { label: 'Jetzt starten', url: '#', variant: 'solid', background: '#0f6a5a', color: '#ffffff', borderRadius: 10 } }
    ];

    var ELEMENT_TYPES = [
        { type: 'text',      icon: 'text',      label: 'Text' },
        { type: 'image',     icon: 'image',     label: 'Bild' },
        { type: 'button',    icon: 'button',    label: 'Button' },
        { type: 'spacer',    icon: 'spacer',    label: 'Abstand' }
    ];

    // Categories used by the template gallery.
    var TEMPLATE_CATEGORIES = [
        { id: 'all',          label: 'Alle' },
        { id: 'newsletter',   label: 'Newsletter' },
        { id: 'discount',     label: 'Rabatt' },
        { id: 'exit-intent',  label: 'Exit-Intent' },
        { id: 'event',        label: 'Event-Promo' },
        { id: 'notice',       label: 'Hinweis' }
    ];

    // Visual presets for the builder. Each template provides a partial layout, a
    // node list and a lightweight preview descriptor for the gallery card.
    // Layout/node values must use BuilderSchema-valid enums; nodes get fresh ids
    // when applied via instantiateTemplate().
    var BUILDER_TEMPLATES = [
        {
            id: 'newsletter-classic',
            category: 'newsletter',
            name: 'Newsletter Klassisch',
            description: 'Zentriertes Karten-Popup mit Headline, Lead und CTA fuer den Newsletter-Funnel.',
            accent: '#0f6a5a',
            preview: { variant: 'card', align: 'center', accent: '#0f6a5a', background: '#ffffff', headline: 'Bleib auf dem Laufenden', sub: 'Sichere dir frische Insights jeden Freitag.', cta: 'Anmelden', tag: 'Newsletter' },
            layout: { width: 520, position: 'center', overlay: true, background: '#ffffff', borderRadius: 22, padding: 40, shadow: 'lg', overlayColor: '#0c1f1a', overlayOpacity: 55, animation: 'zoom' },
            nodes: [
                { type: 'text',   props: { content: 'Bleib auf dem Laufenden', fontSize: 30, fontWeight: 700, color: '#0c1f1a', align: 'center', lineHeight: 1.2, letterSpacing: -0.4, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Sichere dir frische Insights, Tools und Tipps jeden Freitag direkt in dein Postfach.', fontSize: 15, fontWeight: 400, color: '#4f5a55', align: 'center', lineHeight: 1.6, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 12 } },
                { type: 'button', props: { label: 'Jetzt anmelden', url: '#', variant: 'solid', background: '#0f6a5a', color: '#ffffff', borderRadius: 12, fontSize: 15, fontWeight: 700, paddingX: 28, paddingY: 14, shadow: true, width: 'full', trackConversion: true } },
                { type: 'text',   props: { content: 'Kein Spam. Jederzeit abbestellbar.', fontSize: 12, fontWeight: 500, color: '#8a9089', align: 'center', lineHeight: 1.5, letterSpacing: 0.4, textDecoration: 'none' } }
            ]
        },
        {
            id: 'newsletter-bold',
            category: 'newsletter',
            name: 'Newsletter Bold',
            description: 'Markante Slide-Up-Karte unten rechts mit dunklem Hintergrund und Akzentfarbe.',
            accent: '#7c5cff',
            preview: { variant: 'corner', align: 'left', accent: '#7c5cff', background: '#10131a', textColor: '#f4f1ff', headline: 'Insider-Drop', sub: 'Jede Woche neue Ideen aus unserem Studio.', cta: 'Dabei sein', tag: 'Drop' },
            layout: { width: 420, position: 'bottom-right', overlay: false, background: '#10131a', borderRadius: 20, padding: 28, shadow: 'xl', overlayColor: '#000000', overlayOpacity: 40, animation: 'slide-up' },
            nodes: [
                { type: 'text',   props: { content: 'Insider-Drop', fontSize: 13, fontWeight: 700, color: '#7c5cff', align: 'left', lineHeight: 1.3, letterSpacing: 1.6, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Studio-Updates direkt in dein Postfach', fontSize: 24, fontWeight: 700, color: '#f4f1ff', align: 'left', lineHeight: 1.25, letterSpacing: -0.2, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Jede Woche kuratierte Ideen, Werkzeuge und Vorlagen.', fontSize: 14, fontWeight: 400, color: '#a9adba', align: 'left', lineHeight: 1.55, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 8 } },
                { type: 'button', props: { label: 'Anmelden', url: '#', variant: 'solid', background: '#7c5cff', color: '#ffffff', borderRadius: 999, fontSize: 14, fontWeight: 700, paddingX: 24, paddingY: 12, shadow: true, width: 'auto', trackConversion: true } }
            ]
        },
        {
            id: 'discount-burst',
            category: 'discount',
            name: 'Rabatt Burst',
            description: 'Hochwertiger Rabatt-Layer mit Badge, Headline und prominentem Code.',
            accent: '#e26a4c',
            preview: { variant: 'card', align: 'center', accent: '#e26a4c', background: '#fff6f0', headline: '15 % geschenkt', sub: 'Code COMFORT24 sichern.', cta: 'Jetzt einloesen', tag: 'Sale' },
            layout: { width: 540, position: 'center', overlay: true, background: '#fff6f0', borderRadius: 24, padding: 44, shadow: 'lg', overlayColor: '#1c0e08', overlayOpacity: 60, animation: 'zoom' },
            nodes: [
                { type: 'text',   props: { content: 'Limitierte Aktion', fontSize: 12, fontWeight: 700, color: '#e26a4c', align: 'center', lineHeight: 1.3, letterSpacing: 2.2, textDecoration: 'none' } },
                { type: 'text',   props: { content: '15 % auf alles geschenkt', fontSize: 36, fontWeight: 700, color: '#1c0e08', align: 'center', lineHeight: 1.1, letterSpacing: -0.6, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Mit Code COMFORT24 im Checkout. Nur fuer kurze Zeit.', fontSize: 15, fontWeight: 500, color: '#6b4c3f', align: 'center', lineHeight: 1.55, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 14 } },
                { type: 'button', props: { label: 'Code aktivieren', url: '#', variant: 'solid', background: '#e26a4c', color: '#ffffff', borderRadius: 14, fontSize: 16, fontWeight: 700, paddingX: 32, paddingY: 14, shadow: true, width: 'full', trackConversion: true } }
            ]
        },
        {
            id: 'discount-stripe',
            category: 'discount',
            name: 'Rabatt Streifen',
            description: 'Schlanker Promo-Streifen oben mit Inline-Code und CTA.',
            accent: '#1f4dd8',
            preview: { variant: 'bar', align: 'left', accent: '#1f4dd8', background: '#0b1f4f', textColor: '#ffffff', headline: 'Spring Sale', sub: '-20 % mit BLUE20', cta: 'Shoppen' },
            layout: { width: 1100, position: 'top-center', overlay: false, background: '#0b1f4f', borderRadius: 0, padding: 18, shadow: 'sm', overlayColor: '#000000', overlayOpacity: 30, animation: 'slide-down' },
            nodes: [
                { type: 'text',   props: { content: 'Spring Sale - 20 % auf die neue Kollektion mit Code BLUE20', fontSize: 14, fontWeight: 600, color: '#ffffff', align: 'center', lineHeight: 1.4, letterSpacing: 0.2, textDecoration: 'none' } },
                { type: 'button', props: { label: 'Jetzt shoppen', url: '#', variant: 'solid', background: '#1f4dd8', color: '#ffffff', borderRadius: 999, fontSize: 13, fontWeight: 700, paddingX: 20, paddingY: 8, shadow: false, width: 'auto', trackConversion: true } }
            ]
        },
        {
            id: 'exit-intent-save',
            category: 'exit-intent',
            name: 'Exit Save',
            description: 'Dramatischer Layer mit Frage-Headline und Goodie fuer Exit-Intent.',
            accent: '#c84357',
            preview: { variant: 'card', align: 'center', accent: '#c84357', background: '#fffafb', headline: 'Warte einen Moment', sub: 'Dein 10-Euro-Gutschein wartet.', cta: 'Gutschein sichern', tag: 'Exit' },
            layout: { width: 560, position: 'center', overlay: true, background: '#fffafb', borderRadius: 22, padding: 44, shadow: 'xl', overlayColor: '#1a0306', overlayOpacity: 70, animation: 'zoom' },
            nodes: [
                { type: 'text',   props: { content: 'Warte einen Moment', fontSize: 32, fontWeight: 700, color: '#1a0306', align: 'center', lineHeight: 1.15, letterSpacing: -0.4, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Bevor du gehst: Sichere dir 10 Euro fuer deine erste Bestellung.', fontSize: 15, fontWeight: 500, color: '#5b3a40', align: 'center', lineHeight: 1.55, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 12 } },
                { type: 'button', props: { label: 'Gutschein sichern', url: '#', variant: 'solid', background: '#c84357', color: '#ffffff', borderRadius: 12, fontSize: 15, fontWeight: 700, paddingX: 28, paddingY: 14, shadow: true, width: 'full', trackConversion: true } },
                { type: 'text',   props: { content: 'Nein danke, ich moechte den Vorteil nicht.', fontSize: 12, fontWeight: 500, color: '#8a7077', align: 'center', lineHeight: 1.4, letterSpacing: 0.2, textDecoration: 'underline' } }
            ]
        },
        {
            id: 'exit-intent-coupon',
            category: 'exit-intent',
            name: 'Exit Coupon',
            description: 'Klar strukturierte Karte mit Coupon-Code und Konversionsbutton.',
            accent: '#0f6a5a',
            preview: { variant: 'card', align: 'center', accent: '#0f6a5a', background: '#ffffff', headline: 'Dein Code: STAY10', sub: 'Spare 10 Prozent auf deinen Warenkorb.', cta: 'Code anwenden', tag: 'Bonus' },
            layout: { width: 500, position: 'center', overlay: true, background: '#ffffff', borderRadius: 18, padding: 36, shadow: 'lg', overlayColor: '#0c1f1a', overlayOpacity: 65, animation: 'fade' },
            nodes: [
                { type: 'text',   props: { content: 'Dein persoenlicher Code', fontSize: 12, fontWeight: 700, color: '#0f6a5a', align: 'center', lineHeight: 1.3, letterSpacing: 2, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'STAY10', fontSize: 42, fontWeight: 700, color: '#0c1f1a', align: 'center', lineHeight: 1.05, letterSpacing: 4, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Spare 10 Prozent auf deinen aktuellen Warenkorb.', fontSize: 14, fontWeight: 500, color: '#4f5a55', align: 'center', lineHeight: 1.55, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 12 } },
                { type: 'button', props: { label: 'Code anwenden', url: '#', variant: 'solid', background: '#0f6a5a', color: '#ffffff', borderRadius: 10, fontSize: 15, fontWeight: 700, paddingX: 28, paddingY: 12, shadow: true, width: 'full', trackConversion: true } }
            ]
        },
        {
            id: 'event-launch',
            category: 'event',
            name: 'Event Launch',
            description: 'Atmosphaerischer Layer fuer Produkt-Launches mit Datum und CTA.',
            accent: '#f4b134',
            preview: { variant: 'card', align: 'center', accent: '#f4b134', background: '#0e1620', textColor: '#fef3d8', headline: 'Launch Day 24.05.', sub: 'Sei live dabei, wenn wir die neue Kollektion zeigen.', cta: 'Reminder setzen', tag: 'Live' },
            layout: { width: 580, position: 'center', overlay: true, background: '#0e1620', borderRadius: 20, padding: 44, shadow: 'xl', overlayColor: '#000000', overlayOpacity: 75, animation: 'fade' },
            nodes: [
                { type: 'text',   props: { content: 'Live Event - 24.05.', fontSize: 13, fontWeight: 700, color: '#f4b134', align: 'center', lineHeight: 1.3, letterSpacing: 2.4, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Die neue Kollektion. Live.', fontSize: 32, fontWeight: 700, color: '#fef3d8', align: 'center', lineHeight: 1.15, letterSpacing: -0.4, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Reserviere dir den Termin und sei dabei, wenn wir das neue Lineup zeigen.', fontSize: 15, fontWeight: 400, color: '#b6bdc9', align: 'center', lineHeight: 1.6, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 14 } },
                { type: 'button', props: { label: 'Reminder setzen', url: '#', variant: 'solid', background: '#f4b134', color: '#0e1620', borderRadius: 12, fontSize: 15, fontWeight: 700, paddingX: 28, paddingY: 14, shadow: true, width: 'full', trackConversion: true } }
            ]
        },
        {
            id: 'event-webinar',
            category: 'event',
            name: 'Event Webinar',
            description: 'Karte unten links fuer Webinare mit Datum, Sprecher und Anmeldung.',
            accent: '#1f4dd8',
            preview: { variant: 'corner', align: 'left', accent: '#1f4dd8', background: '#ffffff', headline: 'Webinar am 18.06.', sub: 'Skalierbare Funnels mit LegacyPopups.', cta: 'Platz sichern', tag: 'Webinar' },
            layout: { width: 400, position: 'bottom-left', overlay: false, background: '#ffffff', borderRadius: 18, padding: 28, shadow: 'xl', overlayColor: '#000000', overlayOpacity: 30, animation: 'slide-up' },
            nodes: [
                { type: 'text',   props: { content: 'Webinar - 18.06. - 17:00', fontSize: 12, fontWeight: 700, color: '#1f4dd8', align: 'left', lineHeight: 1.3, letterSpacing: 1.6, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Skalierbare Funnels mit LegacyPopups', fontSize: 22, fontWeight: 700, color: '#0c1430', align: 'left', lineHeight: 1.2, letterSpacing: -0.2, textDecoration: 'none' } },
                { type: 'text',   props: { content: '45 Minuten Live-Session inklusive Q&A.', fontSize: 13, fontWeight: 500, color: '#5e667d', align: 'left', lineHeight: 1.5, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 8 } },
                { type: 'button', props: { label: 'Platz sichern', url: '#', variant: 'solid', background: '#1f4dd8', color: '#ffffff', borderRadius: 999, fontSize: 13, fontWeight: 700, paddingX: 22, paddingY: 10, shadow: true, width: 'auto', trackConversion: true } }
            ]
        },
        {
            id: 'notice-cookie',
            category: 'notice',
            name: 'Hinweis Cookie',
            description: 'Zurueckhaltender Hinweisstreifen unten mit Akzeptieren-Button.',
            accent: '#0f6a5a',
            preview: { variant: 'bar', align: 'left', accent: '#0f6a5a', background: '#ffffff', textColor: '#1a1a1d', headline: 'Wir verwenden Cookies', sub: 'Damit unsere Seite optimal fuer dich funktioniert.', cta: 'Akzeptieren' },
            layout: { width: 1100, position: 'bottom-center', overlay: false, background: '#ffffff', borderRadius: 16, padding: 22, shadow: 'lg', overlayColor: '#000000', overlayOpacity: 30, animation: 'slide-up' },
            nodes: [
                { type: 'text',   props: { content: 'Wir verwenden Cookies, damit unsere Seite optimal fuer dich funktioniert. Du kannst die Einstellungen jederzeit anpassen.', fontSize: 14, fontWeight: 500, color: '#1a1a1d', align: 'left', lineHeight: 1.5, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 8 } },
                { type: 'button', props: { label: 'Akzeptieren', url: '#', variant: 'solid', background: '#0f6a5a', color: '#ffffff', borderRadius: 10, fontSize: 13, fontWeight: 700, paddingX: 20, paddingY: 10, shadow: false, width: 'auto', trackConversion: false } }
            ]
        },
        {
            id: 'notice-update',
            category: 'notice',
            name: 'Hinweis Update',
            description: 'Karte oben fuer System-Hinweise, Wartungsinfos oder Update-Ankuendigungen.',
            accent: '#f4b134',
            preview: { variant: 'card', align: 'left', accent: '#f4b134', background: '#fff8e6', headline: 'Geplantes Update', sub: 'Wir aktualisieren das System am Sonntag.', cta: 'Mehr erfahren', tag: 'Hinweis' },
            layout: { width: 520, position: 'top-center', overlay: false, background: '#fff8e6', borderRadius: 16, padding: 24, shadow: 'md', overlayColor: '#000000', overlayOpacity: 30, animation: 'slide-down' },
            nodes: [
                { type: 'text',   props: { content: 'Geplantes Update am Sonntag', fontSize: 18, fontWeight: 700, color: '#5a3d05', align: 'left', lineHeight: 1.25, letterSpacing: -0.2, textDecoration: 'none' } },
                { type: 'text',   props: { content: 'Zwischen 02:00 und 04:00 Uhr fuehren wir Wartungsarbeiten durch. Es kann zu kurzen Ausfallzeiten kommen.', fontSize: 13, fontWeight: 500, color: '#7a5a1a', align: 'left', lineHeight: 1.55, letterSpacing: 0, textDecoration: 'none' } },
                { type: 'spacer', props: { height: 6 } },
                { type: 'button', props: { label: 'Mehr erfahren', url: '#', variant: 'outline', background: '#ffffff', color: '#5a3d05', borderRadius: 10, fontSize: 13, fontWeight: 700, paddingX: 18, paddingY: 8, shadow: false, width: 'auto', trackConversion: false } }
            ]
        }
    ];

    function instantiateTemplate(template) {
        var layout = Object.assign({}, DEFAULT_BUILDER_LAYOUT, isPlainObject(template.layout) ? template.layout : {});
        var nodes = (template.nodes || []).map(function (node) {
            return {
                id: makeNodeId(),
                type: node.type,
                props: Object.assign({}, node.props || {})
            };
        });

        return {
            version: BUILDER_SCHEMA_VERSION,
            layout: layout,
            nodes: nodes
        };
    }

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function createEmptyBuilderSchema() {
        return {
            version: BUILDER_SCHEMA_VERSION,
            layout: cloneJson(DEFAULT_BUILDER_LAYOUT),
            nodes: []
        };
    }

    function createStarterBuilderSchema() {
        var schema = createEmptyBuilderSchema();
        schema.nodes = cloneJson(DEFAULT_BUILDER_NODES);

        return schema;
    }

    function makeNodeId() {
        return 'node-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    }

    function defaultNodeProps(type) {
        switch (type) {
            case 'text':   return { content: 'Neuer Text', fontSize: 16, fontWeight: 400, color: '#1a1a1d', align: 'left', lineHeight: 1.5, letterSpacing: 0, textDecoration: 'none' };
            case 'image':  return { src: '', alt: '', width: '100%', borderRadius: 4, shadow: false, objectFit: 'cover' };
            case 'button': return { label: 'Klick mich', url: '#', variant: 'solid', background: '#0f6a5a', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 600, paddingX: 24, paddingY: 10, shadow: false, width: 'auto' };
            case 'spacer': return { height: 24 };
            default:       return {};
        }
    }

    function createBuilderNode(type) {
        return {
            id: makeNodeId(),
            type: type,
            props: defaultNodeProps(type)
        };
    }

    function normalizeInt(value, fallback, min, max) {
        var parsed = parseInt(value, 10);

        if (window.isNaN(parsed)) {
            return fallback;
        }

        if (typeof min === 'number' && parsed < min) {
            return min;
        }

        if (typeof max === 'number' && parsed > max) {
            return max;
        }

        return parsed;
    }

    function normalizeBool(value, fallback) {
        if (typeof value === 'boolean') {
            return value;
        }

        if (value === 1 || value === '1' || value === 'true') {
            return true;
        }

        if (value === 0 || value === '0' || value === 'false') {
            return false;
        }

        return fallback;
    }

    function normalizeEnum(value, allowed, fallback) {
        if (typeof value !== 'string') {
            return fallback;
        }

        return allowed.indexOf(value) !== -1 ? value : fallback;
    }

    function normalizeColor(value, fallback) {
        return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }

    function normalizeString(value, fallback) {
        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'number') {
            return String(value);
        }

        return fallback;
    }

    function normalizeFloat(value, fallback, min, max) {
        var parsed = parseFloat(value);

        if (window.isNaN(parsed)) {
            return fallback;
        }

        if (typeof min === 'number' && parsed < min) {
            return min;
        }

        if (typeof max === 'number' && parsed > max) {
            return max;
        }

        return parsed;
    }

    function normalizeBuilderLayout(rawLayout) {
        var layout = isPlainObject(rawLayout) ? rawLayout : {};

        return {
            width: normalizeInt(layout.width, DEFAULT_BUILDER_LAYOUT.width, 240, 1200),
            position: normalizeEnum(layout.position, ['center', 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'], DEFAULT_BUILDER_LAYOUT.position),
            overlay: normalizeBool(layout.overlay, DEFAULT_BUILDER_LAYOUT.overlay),
            background: normalizeColor(layout.background, DEFAULT_BUILDER_LAYOUT.background),
            borderRadius: normalizeInt(layout.borderRadius, DEFAULT_BUILDER_LAYOUT.borderRadius, 0, 80),
            padding: normalizeInt(layout.padding, DEFAULT_BUILDER_LAYOUT.padding, 0, 160),
            shadow: normalizeEnum(layout.shadow, ['none', 'sm', 'md', 'lg', 'xl'], DEFAULT_BUILDER_LAYOUT.shadow),
            overlayColor: normalizeColor(layout.overlayColor, DEFAULT_BUILDER_LAYOUT.overlayColor),
            overlayOpacity: normalizeInt(layout.overlayOpacity, DEFAULT_BUILDER_LAYOUT.overlayOpacity, 0, 100),
            animation: normalizeEnum(layout.animation, ['none', 'fade', 'slide-up', 'slide-down', 'zoom'], DEFAULT_BUILDER_LAYOUT.animation)
        };
    }

    function normalizeBuilderNodeProps(type, rawProps) {
        var props = isPlainObject(rawProps) ? rawProps : {};

        if (type === 'text') {
            return {
                content: normalizeString(props.content, ''),
                fontSize: normalizeInt(props.fontSize, 16, 8, 96),
                fontWeight: normalizeInt(props.fontWeight, 400, 100, 900),
                color: normalizeColor(props.color, '#1a1a1d'),
                align: normalizeEnum(props.align, ['left', 'center', 'right'], 'left'),
                lineHeight: normalizeFloat(props.lineHeight, 1.5, 1.0, 3.0),
                letterSpacing: normalizeFloat(props.letterSpacing, 0, -2, 8),
                textDecoration: normalizeEnum(props.textDecoration, ['none', 'underline', 'line-through'], 'none')
            };
        }

        if (type === 'image') {
            return {
                src: normalizeString(props.src, ''),
                alt: normalizeString(props.alt, ''),
                width: normalizeString(props.width, '100%'),
                borderRadius: normalizeInt(props.borderRadius, 4, 0, 80),
                shadow: normalizeBool(props.shadow, false),
                objectFit: normalizeEnum(props.objectFit, ['cover', 'contain', 'fill'], 'cover')
            };
        }

        if (type === 'button') {
            return {
                label: normalizeString(props.label, ''),
                url: normalizeString(props.url, '#'),
                variant: normalizeEnum(props.variant, ['solid', 'outline', 'ghost'], 'solid'),
                background: normalizeColor(props.background, '#0f6a5a'),
                color: normalizeColor(props.color, '#ffffff'),
                borderRadius: normalizeInt(props.borderRadius, 8, 0, 80),
                fontSize: normalizeInt(props.fontSize, 14, 8, 48),
                fontWeight: normalizeInt(props.fontWeight, 600, 100, 900),
                paddingX: normalizeInt(props.paddingX, 24, 4, 80),
                paddingY: normalizeInt(props.paddingY, 10, 2, 40),
                shadow: normalizeBool(props.shadow, false),
                width: normalizeEnum(props.width, ['auto', 'full'], 'auto')
            };
        }

        if (type === 'spacer') {
            return {
                height: normalizeInt(props.height, 24, 4, 400)
            };
        }

        return Object.assign({}, props);
    }

    function normalizeBuilderNode(rawNode, index) {
        var node = isPlainObject(rawNode) ? rawNode : {};
        var type = normalizeString(node.type, 'text');
        var id = normalizeString(node.id, '');

        return {
            id: id || ('node-' + (index + 1)),
            type: type,
            props: normalizeBuilderNodeProps(type, node.props)
        };
    }

    function normalizeBuilderSchemaV1(rawSchema) {
        var schema = isPlainObject(rawSchema) ? rawSchema : {};
        var nodes = Array.isArray(schema.nodes) ? schema.nodes : [];

        return {
            version: BUILDER_SCHEMA_VERSION,
            layout: normalizeBuilderLayout(schema.layout),
            nodes: nodes.filter(function (node) {
                return isPlainObject(node);
            }).map(function (node, index) {
                return normalizeBuilderNode(node, index);
            })
        };
    }

    function migrateBuilderSchema(rawSchema) {
        var schema = isPlainObject(rawSchema) ? rawSchema : {};
        var version = normalizeInt(schema.version, 1, 1, BUILDER_SCHEMA_VERSION);

        while (version < BUILDER_SCHEMA_VERSION) {
            switch (version) {
                default:
                    version = BUILDER_SCHEMA_VERSION;
                    break;
            }
        }

        return normalizeBuilderSchemaV1(schema);
    }

    function normalizeBuilderSchema(rawSchema) {
        return migrateBuilderSchema(rawSchema);
    }

    function useBuilderState(config) {
        var popupOptions = (config && config.popups) || [];
        var onCreatePopup = config && config.onCreatePopup;
        var onAfterSave = config && config.onAfterSave;
        var schemaState    = useState(createStarterBuilderSchema());
        var schema         = schemaState[0];
        var setSchema      = schemaState[1];
        var selState       = useState(null);
        var selectedNodeId = selState[0];
        var setSelectedNodeId = selState[1];
        var titleState     = useState(__('Neues Popup', 'legacy-popups'));
        var popupTitle     = titleState[0];
        var setPopupTitleValue  = titleState[1];
        var popupIdState   = useState(null);
        var activePopupId  = popupIdState[0];
        var setActivePopupId = popupIdState[1];
        var dirtyState     = useState(false);
        var isDirty        = dirtyState[0];
        var setIsDirty     = dirtyState[1];
        var loadingState   = useState(false);
        var isLoadingPopup = loadingState[0];
        var setIsLoadingPopup = loadingState[1];
        var savingState    = useState(false);
        var isSavingPopup  = savingState[0];
        var setIsSavingPopup = savingState[1];
        var creatingState  = useState(false);
        var isCreatingPopup = creatingState[0];
        var setIsCreatingPopup = creatingState[1];
        var errorState     = useState('');
        var errorMessage   = errorState[0];
        var setErrorMessage = errorState[1];
        var noticeState    = useState('');
        var noticeMessage  = noticeState[0];
        var setNoticeMessage = noticeState[1];

        useEffect(function () {
            if (!popupOptions.length) {
                if (activePopupId !== null) {
                    setActivePopupId(null);
                }

                return;
            }

            var hasActivePopup = popupOptions.some(function (popup) {
                return popup.id === activePopupId;
            });

            if (!hasActivePopup) {
                setActivePopupId(popupOptions[0].id);
            }
        }, [popupOptions, activePopupId]);

        useEffect(function () {
            var hasSelectedNode = !selectedNodeId || schema.nodes.some(function (node) {
                return node.id === selectedNodeId;
            });

            if (!hasSelectedNode) {
                setSelectedNodeId(null);
            }
        }, [schema, selectedNodeId]);

        useEffect(function () {
            var cancelled = false;

            if (!activePopupId) {
                setSchema(createStarterBuilderSchema());
                setPopupTitleValue(__('Neues Popup', 'legacy-popups'));
                setSelectedNodeId(null);
                setIsDirty(false);
                setErrorMessage('');
                return function () {
                    cancelled = true;
                };
            }

            setIsLoadingPopup(true);
            setErrorMessage('');

            PopupApi.get(activePopupId).then(function (popup) {
                if (cancelled) {
                    return;
                }

                setSchema(normalizeBuilderSchema(popup.builder_schema));
                setPopupTitleValue(popup.title || __('Neues Popup', 'legacy-popups'));
                setSelectedNodeId(null);
                setIsDirty(false);
            }).catch(function (error) {
                if (cancelled) {
                    return;
                }

                setErrorMessage(error.message || __('Das Popup konnte nicht geladen werden.', 'legacy-popups'));
            }).finally(function () {
                if (!cancelled) {
                    setIsLoadingPopup(false);
                }
            });

            return function () {
                cancelled = true;
            };
        }, [activePopupId]);

        function commitSchema(update) {
            setSchema(function (previousSchema) {
                var nextSchema = typeof update === 'function'
                    ? update(normalizeBuilderSchema(previousSchema))
                    : update;

                return normalizeBuilderSchema(nextSchema);
            });
            setIsDirty(true);
            setNoticeMessage('');
        }

        function updatePopupTitle(nextTitle) {
            setPopupTitleValue(nextTitle);
            setIsDirty(true);
            setNoticeMessage('');
        }

        function addNode(type) {
            var node = createBuilderNode(type);

            commitSchema(function (previousSchema) {
                return Object.assign({}, previousSchema, {
                    nodes: previousSchema.nodes.concat([node])
                });
            });
            setSelectedNodeId(node.id);
        }

        function removeNode(id) {
            commitSchema(function (previousSchema) {
                return Object.assign({}, previousSchema, {
                    nodes: previousSchema.nodes.filter(function (node) {
                        return node.id !== id;
                    })
                });
            });
            setSelectedNodeId(null);
        }

        function updateNode(id, partialProps) {
            commitSchema(function (previousSchema) {
                return Object.assign({}, previousSchema, {
                    nodes: previousSchema.nodes.map(function (node) {
                        if (node.id !== id) {
                            return node;
                        }

                        return Object.assign({}, node, {
                            props: Object.assign({}, node.props, partialProps)
                        });
                    })
                });
            });
        }

        function updateLayout(partialLayout) {
            commitSchema(function (previousSchema) {
                return Object.assign({}, previousSchema, {
                    layout: Object.assign({}, previousSchema.layout, partialLayout)
                });
            });
        }

        function applyTemplate(template) {
            if (!template) {
                return;
            }

            commitSchema(function () {
                return instantiateTemplate(template);
            });
            setSelectedNodeId(null);
            setNoticeMessage(__('Vorlage uebernommen. Speichere, um sie zu sichern.', 'legacy-popups'));
        }

        function moveNode(id, direction) {
            commitSchema(function (previousSchema) {
                var nodes = previousSchema.nodes.slice();
                var idx = nodes.findIndex(function (node) {
                    return node.id === id;
                });

                if (idx === -1) {
                    return previousSchema;
                }

                var targetIdx = direction === 'up' ? idx - 1 : idx + 1;

                if (targetIdx < 0 || targetIdx >= nodes.length) {
                    return previousSchema;
                }

                var tmp = nodes[idx];
                nodes[idx] = nodes[targetIdx];
                nodes[targetIdx] = tmp;

                return Object.assign({}, previousSchema, { nodes: nodes });
            });
        }

        function selectNode(id) {
            setSelectedNodeId(id);
        }

        function selectPopup(popupId) {
            var nextPopupId = popupId ? parseInt(popupId, 10) : null;

            if (!nextPopupId || nextPopupId === activePopupId) {
                return;
            }

            if (isDirty && !window.confirm(__('Ungelesene Aenderungen gehen verloren. Trotzdem wechseln?', 'legacy-popups'))) {
                return;
            }

            setActivePopupId(nextPopupId);
        }

        function savePopup() {
            if (!activePopupId) {
                return Promise.resolve(null);
            }

            setIsSavingPopup(true);
            setErrorMessage('');

            return PopupApi.update(activePopupId, {
                title: popupTitle || __('Neues Popup', 'legacy-popups'),
                builder_schema: normalizeBuilderSchema(schema)
            }).then(function (popup) {
                setSchema(normalizeBuilderSchema(popup.builder_schema));
                setPopupTitleValue(popup.title || __('Neues Popup', 'legacy-popups'));
                setIsDirty(false);
                setNoticeMessage(__('Builder wurde gespeichert.', 'legacy-popups'));

                if (typeof onAfterSave === 'function') {
                    return Promise.resolve(onAfterSave()).then(function () {
                        return popup;
                    });
                }

                return popup;
            }).catch(function (error) {
                setErrorMessage(error.message || __('Der Builder konnte nicht gespeichert werden.', 'legacy-popups'));
                return null;
            }).finally(function () {
                setIsSavingPopup(false);
            });
        }

        function createPopup() {
            if (typeof onCreatePopup !== 'function') {
                return Promise.resolve(null);
            }

            setIsCreatingPopup(true);
            setErrorMessage('');

            return onCreatePopup().then(function (popup) {
                if (!popup || !popup.id) {
                    return null;
                }

                setNoticeMessage(__('Popup wurde erstellt und im Builder geoeffnet.', 'legacy-popups'));
                setActivePopupId(popup.id);

                return popup;
            }).catch(function (error) {
                setErrorMessage(error.message || __('Das Popup konnte nicht erstellt werden.', 'legacy-popups'));
                return null;
            }).finally(function () {
                setIsCreatingPopup(false);
            });
        }

        function dismissMessage() {
            setErrorMessage('');
            setNoticeMessage('');
        }

        return {
            activePopupId: activePopupId,
            schema: schema,
            selectedNodeId: selectedNodeId,
            popupTitle: popupTitle,
            isDirty: isDirty,
            isLoadingPopup: isLoadingPopup,
            isSavingPopup: isSavingPopup,
            isCreatingPopup: isCreatingPopup,
            errorMessage: errorMessage,
            noticeMessage: noticeMessage,
            setPopupTitle: updatePopupTitle,
            addNode: addNode,
            removeNode: removeNode,
            updateNode: updateNode,
            updateLayout: updateLayout,
            moveNode: moveNode,
            selectNode: selectNode,
            selectPopup: selectPopup,
            savePopup: savePopup,
            createPopup: createPopup,
            applyTemplate: applyTemplate,
            dismissMessage: dismissMessage
        };
    }

    // --- BuilderSidebar ---

    function BuilderSidebar(props) {
        var onAdd = props.onAdd;
        var onOpenTemplates = props.onOpenTemplates;

        return el('aside', { className: 'lp-builder__sidebar' },
            el('div', { className: 'lp-builder__sidebar-section' },
                el('p', { className: 'lp-builder__section-label' }, __('Elemente', 'legacy-popups')),
                el('div', { className: 'lp-element-palette' },
                    ELEMENT_TYPES.map(function (et) {
                        return el('button', {
                            key: et.type,
                            type: 'button',
                            className: 'lp-element-tile',
                            title: et.label,
                            onClick: function () { onAdd(et.type); }
                        },
                            el(Icon, { name: et.icon, stroke: true, size: 20, className: 'lp-element-tile__icon' }),
                            el('span', { className: 'lp-element-tile__label' }, et.label)
                        );
                    })
                )
            ),
            el('div', { className: 'lp-builder__sidebar-section' },
                el('p', { className: 'lp-builder__section-label' }, __('Vorlagen', 'legacy-popups')),
                el('button', {
                    type: 'button',
                    className: 'lp-templates-launcher',
                    onClick: onOpenTemplates
                },
                    el('span', { className: 'lp-templates-launcher__icon', 'aria-hidden': true },
                        el(Icon, { name: 'sparkles', stroke: true, size: 18 })
                    ),
                    el('span', { className: 'lp-templates-launcher__body' },
                        el('span', { className: 'lp-templates-launcher__title' }, __('Vorlagenbibliothek', 'legacy-popups')),
                        el('span', { className: 'lp-templates-launcher__hint' }, __('Profi-Layouts fuer Newsletter, Rabatt, Exit-Intent, Events und Hinweise.', 'legacy-popups'))
                    )
                )
            )
        );
    }

    // --- BuilderCanvas ---

    function hexToRgba(hex, alpha) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            return 'rgba(0,0,0,' + alpha + ')';
        }
        return 'rgba(' + parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16) + ',' + alpha + ')';
    }

    var SHADOW_MAP = {
        none: 'none',
        sm:   '0 2px 8px rgba(0,0,0,0.10)',
        md:   '0 8px 32px rgba(0,0,0,0.15)',
        lg:   '0 16px 56px rgba(0,0,0,0.22)',
        xl:   '0 24px 80px rgba(0,0,0,0.28)'
    };

    function BuilderNodeText(props) {
        var p = props.nodeProps;
        return el('div', {
            className: 'lp-node lp-node-text' + (props.selected ? ' is-selected' : ''),
            onClick: props.onSelect,
            style: {
                fontSize: (p.fontSize || 16) + 'px',
                fontWeight: p.fontWeight || 400,
                color: p.color || '#1a1a1d',
                textAlign: p.align || 'left',
                lineHeight: p.lineHeight || 1.5,
                letterSpacing: (p.letterSpacing !== undefined ? p.letterSpacing : 0) + 'px',
                textDecoration: p.textDecoration || 'none'
            }
        }, p.content || '');
    }

    function BuilderNodeImage(props) {
        var p = props.nodeProps;
        var imgStyle = {
            width: p.width || '100%',
            borderRadius: (p.borderRadius || 0) + 'px',
            objectFit: p.objectFit || 'cover',
            display: 'block',
            boxShadow: p.shadow ? '0 4px 18px rgba(0,0,0,0.18)' : 'none'
        };
        return el('div', {
            className: 'lp-node lp-node-image' + (props.selected ? ' is-selected' : ''),
            onClick: props.onSelect
        },
            p.src
                ? el('img', { src: p.src, alt: p.alt || '', style: imgStyle })
                : el('div', { className: 'lp-node-image__placeholder' },
                    el(Icon, { name: 'image', stroke: true, size: 32, className: 'lp-node-image__icon' }),
                                        el('span', null, __('Bild-URL eingeben', 'legacy-popups'))
                  )
        );
    }

    function BuilderNodeButton(props) {
        var p = props.nodeProps;
        var cls = 'lp-node lp-node-button lp-node-button--' + (p.variant || 'solid') + (props.selected ? ' is-selected' : '');
        var innerStyle = {
            fontSize: (p.fontSize || 14) + 'px',
            fontWeight: p.fontWeight || 600,
            padding: (p.paddingY || 10) + 'px ' + (p.paddingX || 24) + 'px',
            display: p.width === 'full' ? 'block' : 'inline-block',
            width: p.width === 'full' ? '100%' : 'auto',
            textAlign: 'center',
            borderRadius: (p.borderRadius || 8) + 'px',
            cursor: 'pointer',
            boxShadow: p.shadow ? '0 4px 14px rgba(0,0,0,0.2)' : 'none',
            transition: 'opacity 0.15s'
        };
        if (p.variant === 'solid') {
            innerStyle.background = p.background || '#0f6a5a';
            innerStyle.color = p.color || '#fff';
        } else if (p.variant === 'outline') {
            innerStyle.border = '2px solid ' + (p.background || '#0f6a5a');
            innerStyle.color = p.background || '#0f6a5a';
        } else {
            innerStyle.color = p.background || '#0f6a5a';
        }
        var outerStyle = p.width === 'full' ? { display: 'block' } : {};
        return el('div', { className: cls, onClick: props.onSelect, style: outerStyle },
            el('span', { className: 'lp-node-button__inner', style: innerStyle }, p.label || 'Button')
        );
    }

    function BuilderNodeSpacer(props) {
        var p = props.nodeProps;
        return el('div', {
            className: 'lp-node lp-node-spacer' + (props.selected ? ' is-selected' : ''),
            onClick: props.onSelect,
            style: { height: (p.height || 24) + 'px' }
        },
            el('div', { className: 'lp-node-spacer__line' })
        );
    }

    function BuilderCanvasNode(props) {
        var node = props.node;
        var selected = props.selected;
        var onSelect = props.onSelect;
        var onRemove = props.onRemove;
        var onMove = props.onMove;

        var inner;
        if (node.type === 'text')   inner = el(BuilderNodeText,   { nodeProps: node.props, selected: selected, onSelect: onSelect });
        else if (node.type === 'image')  inner = el(BuilderNodeImage,  { nodeProps: node.props, selected: selected, onSelect: onSelect });
        else if (node.type === 'button') inner = el(BuilderNodeButton, { nodeProps: node.props, selected: selected, onSelect: onSelect });
        else if (node.type === 'spacer') inner = el(BuilderNodeSpacer, { nodeProps: node.props, selected: selected, onSelect: onSelect });
        else inner = el('div', { className: 'lp-node' + (selected ? ' is-selected' : ''), onClick: onSelect }, node.type);

        return el('div', { className: 'lp-canvas-node-wrap' + (selected ? ' is-active' : '') },
            inner,
            selected
                ? el('div', { className: 'lp-node-controls' },
                    el('button', { type: 'button', className: 'lp-node-ctrl', title: __('Nach oben', 'legacy-popups'), onClick: function (e) { e.stopPropagation(); onMove('up'); } },
                        el(Icon, { name: 'undo', stroke: true, size: 13 })
                    ),
                    el('button', { type: 'button', className: 'lp-node-ctrl', title: __('Nach unten', 'legacy-popups'), onClick: function (e) { e.stopPropagation(); onMove('down'); } },
                        el(Icon, { name: 'undo', stroke: true, size: 13, className: 'lp-flip-v' })
                    ),
                                        el('button', { type: 'button', className: 'lp-node-ctrl lp-node-ctrl--danger', title: __('Loeschen', 'legacy-popups'), onClick: function (e) { e.stopPropagation(); onRemove(); } },
                        el(Icon, { name: 'trash', stroke: true, size: 13 })
                    )
                  )
                : null
        );
    }

    function BuilderCanvas(props) {
        var schema         = props.schema;
        var selectedNodeId = props.selectedNodeId;
        var onSelectNode   = props.onSelectNode;
        var onRemoveNode   = props.onRemoveNode;
        var onMoveNode     = props.onMoveNode;
        var viewport       = props.viewport || 'desktop';
        var layout         = schema.layout;

        var opacity = typeof layout.overlayOpacity === 'number' ? layout.overlayOpacity / 100 : 0.5;
        var overlayStyle = layout.overlay
            ? { background: hexToRgba(layout.overlayColor || '#000000', opacity) }
            : { background: 'transparent' };

        var popupStyle = {
            width: layout.width + 'px',
            maxWidth: '100%',
            background: layout.background || '#fff',
            borderRadius: (layout.borderRadius || 0) + 'px',
            padding: (layout.padding || 0) + 'px',
            boxShadow: SHADOW_MAP[layout.shadow || 'md'] || SHADOW_MAP.md
        };

        var vpLabels = { desktop: null, tablet: 'Tablet — 768 px', mobile: 'Mobile — 375 px' };
        var canvasWrapClass = 'lp-builder__canvas-wrap' + (viewport !== 'desktop' ? ' lp-builder__canvas-wrap--' + viewport : '');

        return el('div', {
            className: canvasWrapClass,
            onClick: function (e) {
                if (e.target === e.currentTarget) onSelectNode(null);
            }
        },
            vpLabels[viewport]
                ? el('div', { className: 'lp-builder__device-label' }, vpLabels[viewport])
                : null,
            el('div', { className: 'lp-builder__overlay-preview', style: overlayStyle },
                el('div', {
                    className: 'lp-builder__popup-frame',
                    style: popupStyle,
                    onClick: function (e) {
                        if (e.target === e.currentTarget) onSelectNode(null);
                    }
                },
                    schema.nodes.length === 0
                        ? el('div', { className: 'lp-canvas-empty' },
                            el(Icon, { name: 'plus', stroke: true, size: 24 }),
                            el('p', null, __('Element aus der linken Leiste hinzufügen', 'legacy-popups'))
                          )
                        : schema.nodes.map(function (node) {
                            return el(BuilderCanvasNode, {
                                key: node.id,
                                node: node,
                                selected: selectedNodeId === node.id,
                                onSelect: function (e) { if (e) e.stopPropagation(); onSelectNode(node.id); },
                                onRemove: function () { onRemoveNode(node.id); },
                                onMove: function (dir) { onMoveNode(node.id, dir); }
                            });
                          })
                )
            )
        );
    }

    // --- BuilderProperties ---

    function PropRow(props) {
        return el('div', { className: 'lp-prop-row' },
            el('label', { className: 'lp-prop-label', htmlFor: props.id }, props.label),
            props.children
        );
    }

    function RangeRow(props) {
        return el('div', { className: 'lp-prop-row' },
            el('div', { className: 'lp-range-row__header' },
                el('label', { className: 'lp-prop-label', htmlFor: props.id }, props.label),
                el('span', { className: 'lp-range-row__value' }, String(props.value) + (props.unit || ''))
            ),
            el('input', {
                id: props.id,
                type: 'range',
                className: 'lp-prop-input--range',
                min: props.min,
                max: props.max,
                step: props.step || 1,
                value: props.value,
                onChange: function (e) { props.onChange(parseFloat(e.target.value)); }
            })
        );
    }

    function SegmentedRow(props) {
        return el('div', { className: 'lp-prop-row' },
            el('label', { className: 'lp-prop-label' }, props.label),
            el('div', { className: 'lp-segmented' },
                props.options.map(function (opt) {
                    return el('button', {
                        key: opt.value,
                        type: 'button',
                        className: 'lp-segmented__btn' + (props.value === opt.value ? ' is-active' : ''),
                        onClick: function () { props.onChange(opt.value); }
                    }, opt.label);
                })
            )
        );
    }

    function DesignSection(props) {
        var openState = useState(props.defaultOpen !== false);
        var isOpen = openState[0];
        var setOpen = openState[1];

        return el('div', { className: 'lp-design-section' + (isOpen ? ' is-open' : '') },
            el('button', {
                type: 'button',
                className: 'lp-design-section__toggle',
                onClick: function () { setOpen(!isOpen); }
            },
                el('span', null, props.title),
                el(Icon, { name: 'undo', stroke: true, size: 11, className: 'lp-design-section__arrow' })
            ),
            isOpen
                ? el('div', { className: 'lp-design-section__body' }, props.children)
                : null
        );
    }

    function BuilderPropertiesContainer(props) {
        var layout = props.layout;
        var onChange = props.onChange;

        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, __('Popup-Container', 'legacy-popups')),
            el(PropRow, { label: __('Breite (px)', 'legacy-popups'), id: 'lp-prop-width' },
                el('input', { id: 'lp-prop-width', type: 'number', className: 'lp-prop-input', value: layout.width || 540, min: 200, max: 1200,
                    onChange: function (e) { onChange({ width: parseInt(e.target.value, 10) || 540 }); } })
            ),
            el(PropRow, { label: __('Hintergrund', 'legacy-popups'), id: 'lp-prop-bg' },
                el('input', { id: 'lp-prop-bg', type: 'color', className: 'lp-prop-input lp-prop-input--color', value: layout.background || '#ffffff',
                    onChange: function (e) { onChange({ background: e.target.value }); } })
            ),
            el(PropRow, { label: __('Eckenradius (px)', 'legacy-popups'), id: 'lp-prop-radius' },
                el('input', { id: 'lp-prop-radius', type: 'number', className: 'lp-prop-input', value: layout.borderRadius || 18, min: 0, max: 60,
                    onChange: function (e) { onChange({ borderRadius: parseInt(e.target.value, 10) || 0 }); } })
            ),
            el(PropRow, { label: __('Innenabstand (px)', 'legacy-popups'), id: 'lp-prop-pad' },
                el('input', { id: 'lp-prop-pad', type: 'number', className: 'lp-prop-input', value: layout.padding || 36, min: 0, max: 120,
                    onChange: function (e) { onChange({ padding: parseInt(e.target.value, 10) || 0 }); } })
            ),
            el(SegmentedRow, {
                label: __('Schatten', 'legacy-popups'),
                value: layout.shadow || 'md',
                options: [
                    { value: 'none', label: __('Kein', 'legacy-popups') },
                    { value: 'sm',   label: __('S', 'legacy-popups') },
                    { value: 'md',   label: __('M', 'legacy-popups') },
                    { value: 'lg',   label: __('L', 'legacy-popups') },
                    { value: 'xl',   label: __('XL', 'legacy-popups') }
                ],
                onChange: function (v) { onChange({ shadow: v }); }
            }),
            el(PropRow, { label: __('Animation', 'legacy-popups'), id: 'lp-prop-animation' },
                el('select', { id: 'lp-prop-animation', className: 'lp-prop-input lp-prop-input--select', value: layout.animation || 'fade',
                    onChange: function (e) { onChange({ animation: e.target.value }); } },
                    el('option', { value: 'none' },      __('Keine', 'legacy-popups')),
                    el('option', { value: 'fade' },      __('Einblenden', 'legacy-popups')),
                    el('option', { value: 'slide-up' },  __('Von unten', 'legacy-popups')),
                    el('option', { value: 'slide-down' },__('Von oben', 'legacy-popups')),
                    el('option', { value: 'zoom' },      __('Zoom', 'legacy-popups'))
                )
            ),
            el(PropRow, { label: __('Overlay', 'legacy-popups'), id: 'lp-prop-overlay' },
                el('label', { className: 'lp-prop-toggle' },
                    el('input', { type: 'checkbox', checked: !!layout.overlay,
                        onChange: function (e) { onChange({ overlay: e.target.checked }); } }),
                    el('span', { className: 'lp-prop-toggle__track' })
                )
            ),
            layout.overlay
                ? el(Fragment, null,
                    el(PropRow, { label: __('Overlay-Farbe', 'legacy-popups'), id: 'lp-prop-oc' },
                        el('input', { id: 'lp-prop-oc', type: 'color', className: 'lp-prop-input lp-prop-input--color', value: layout.overlayColor || '#000000',
                            onChange: function (e) { onChange({ overlayColor: e.target.value }); } })
                    ),
                    el(RangeRow, {
                        id: 'lp-prop-oo',
                        label: __('Overlay-Deckkraft', 'legacy-popups'),
                        value: layout.overlayOpacity !== undefined ? layout.overlayOpacity : 50,
                        min: 0, max: 100, step: 1, unit: '%',
                        onChange: function (v) { onChange({ overlayOpacity: v }); }
                    })
                  )
                : null
        );
    }

    function BuilderPropertiesText(props) {
        var p = props.nodeProps;
        var onChange = props.onChange;

        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, __('Text', 'legacy-popups')),
            el(PropRow, { label: __('Inhalt', 'legacy-popups'), id: 'lp-prop-content' },
                el('textarea', { id: 'lp-prop-content', className: 'lp-prop-input lp-prop-input--textarea', value: p.content || '',
                    onChange: function (e) { onChange({ content: e.target.value }); } })
            ),
            el(PropRow, { label: __('Schriftgröße', 'legacy-popups'), id: 'lp-prop-fs' },
                el('input', { id: 'lp-prop-fs', type: 'number', className: 'lp-prop-input', value: p.fontSize || 16, min: 8, max: 96,
                    onChange: function (e) { onChange({ fontSize: parseInt(e.target.value, 10) || 16 }); } })
            ),
            el(PropRow, { label: __('Gewicht', 'legacy-popups'), id: 'lp-prop-fw' },
                el('select', { id: 'lp-prop-fw', className: 'lp-prop-input lp-prop-input--select', value: p.fontWeight || 400,
                    onChange: function (e) { onChange({ fontWeight: parseInt(e.target.value, 10) }); } },
                    el('option', { value: 300 }, __('Leicht', 'legacy-popups')),
                    el('option', { value: 400 }, __('Normal', 'legacy-popups')),
                    el('option', { value: 600 }, __('Halbfett', 'legacy-popups')),
                    el('option', { value: 700 }, __('Fett', 'legacy-popups'))
                )
            ),
            el(PropRow, { label: __('Farbe', 'legacy-popups'), id: 'lp-prop-tc' },
                el('input', { id: 'lp-prop-tc', type: 'color', className: 'lp-prop-input lp-prop-input--color', value: p.color || '#1a1a1d',
                    onChange: function (e) { onChange({ color: e.target.value }); } })
            ),
            el(PropRow, { label: __('Ausrichtung', 'legacy-popups'), id: 'lp-prop-align' },
                el('select', { id: 'lp-prop-align', className: 'lp-prop-input lp-prop-input--select', value: p.align || 'left',
                    onChange: function (e) { onChange({ align: e.target.value }); } },
                    el('option', { value: 'left' }, __('Links', 'legacy-popups')),
                    el('option', { value: 'center' }, __('Mitte', 'legacy-popups')),
                    el('option', { value: 'right' }, __('Rechts', 'legacy-popups'))
                )
            ),
            el(RangeRow, {
                id: 'lp-prop-lh',
                label: __('Zeilenhöhe', 'legacy-popups'),
                value: p.lineHeight !== undefined ? p.lineHeight : 1.5,
                min: 1.0, max: 3.0, step: 0.1, unit: '',
                onChange: function (v) { onChange({ lineHeight: v }); }
            }),
            el(PropRow, { label: __('Zeichenabstand (px)', 'legacy-popups'), id: 'lp-prop-ls' },
                el('input', { id: 'lp-prop-ls', type: 'number', className: 'lp-prop-input', value: p.letterSpacing !== undefined ? p.letterSpacing : 0, min: -2, max: 8, step: 0.5,
                    onChange: function (e) { onChange({ letterSpacing: parseFloat(e.target.value) || 0 }); } })
            ),
            el(PropRow, { label: __('Dekoration', 'legacy-popups'), id: 'lp-prop-td' },
                el('select', { id: 'lp-prop-td', className: 'lp-prop-input lp-prop-input--select', value: p.textDecoration || 'none',
                    onChange: function (e) { onChange({ textDecoration: e.target.value }); } },
                    el('option', { value: 'none' },         __('Keine', 'legacy-popups')),
                    el('option', { value: 'underline' },    __('Unterstrichen', 'legacy-popups')),
                    el('option', { value: 'line-through' }, __('Durchgestrichen', 'legacy-popups'))
                )
            )
        );
    }

    function BuilderPropertiesImage(props) {
        var p = props.nodeProps;
        var onChange = props.onChange;

        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, __('Bild', 'legacy-popups')),
            el(PropRow, { label: __('URL', 'legacy-popups'), id: 'lp-prop-src' },
                el('input', { id: 'lp-prop-src', type: 'url', className: 'lp-prop-input', value: p.src || '', placeholder: 'https://…',
                    onChange: function (e) { onChange({ src: e.target.value }); } })
            ),
            el(PropRow, { label: __('Alt-Text', 'legacy-popups'), id: 'lp-prop-alt' },
                el('input', { id: 'lp-prop-alt', type: 'text', className: 'lp-prop-input', value: p.alt || '',
                    onChange: function (e) { onChange({ alt: e.target.value }); } })
            ),
            el(PropRow, { label: __('Breite', 'legacy-popups'), id: 'lp-prop-iw' },
                el('input', { id: 'lp-prop-iw', type: 'text', className: 'lp-prop-input', value: p.width || '100%', placeholder: '100% oder 320px',
                    onChange: function (e) { onChange({ width: e.target.value }); } })
            ),
            el(PropRow, { label: __('Eckenradius (px)', 'legacy-popups'), id: 'lp-prop-ir' },
                el('input', { id: 'lp-prop-ir', type: 'number', className: 'lp-prop-input', value: p.borderRadius || 0, min: 0, max: 60,
                    onChange: function (e) { onChange({ borderRadius: parseInt(e.target.value, 10) || 0 }); } })
            ),
            el(PropRow, { label: __('Skalierung', 'legacy-popups'), id: 'lp-prop-fit' },
                el('select', { id: 'lp-prop-fit', className: 'lp-prop-input lp-prop-input--select', value: p.objectFit || 'cover',
                    onChange: function (e) { onChange({ objectFit: e.target.value }); } },
                    el('option', { value: 'cover' },   __('Abschneiden', 'legacy-popups')),
                    el('option', { value: 'contain' }, __('Einpassen', 'legacy-popups')),
                    el('option', { value: 'fill' },    __('Strecken', 'legacy-popups'))
                )
            ),
            el(PropRow, { label: __('Schatten', 'legacy-popups'), id: 'lp-prop-ishadow' },
                el('label', { className: 'lp-prop-toggle' },
                    el('input', { type: 'checkbox', checked: !!p.shadow,
                        onChange: function (e) { onChange({ shadow: e.target.checked }); } }),
                    el('span', { className: 'lp-prop-toggle__track' })
                )
            )
        );
    }

    function BuilderPropertiesButton(props) {
        var p = props.nodeProps;
        var onChange = props.onChange;

        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, __('Button', 'legacy-popups')),
            el(PropRow, { label: __('Beschriftung', 'legacy-popups'), id: 'lp-prop-blabel' },
                el('input', { id: 'lp-prop-blabel', type: 'text', className: 'lp-prop-input', value: p.label || '',
                    onChange: function (e) { onChange({ label: e.target.value }); } })
            ),
            el(PropRow, { label: 'URL', id: 'lp-prop-burl' },
                el('input', { id: 'lp-prop-burl', type: 'url', className: 'lp-prop-input', value: p.url || '#', placeholder: 'https://…',
                    onChange: function (e) { onChange({ url: e.target.value }); } })
            ),
            el(PropRow, { label: __('Stil', 'legacy-popups'), id: 'lp-prop-bvariant' },
                el('select', { id: 'lp-prop-bvariant', className: 'lp-prop-input lp-prop-input--select', value: p.variant || 'solid',
                    onChange: function (e) { onChange({ variant: e.target.value }); } },
                    el('option', { value: 'solid' }, __('Gefüllt', 'legacy-popups')),
                    el('option', { value: 'outline' }, __('Umriss', 'legacy-popups')),
                    el('option', { value: 'ghost' }, __('Ghost', 'legacy-popups'))
                )
            ),
            el(PropRow, { label: __('Hauptfarbe', 'legacy-popups'), id: 'lp-prop-bbg' },
                el('input', { id: 'lp-prop-bbg', type: 'color', className: 'lp-prop-input lp-prop-input--color', value: p.background || '#0f6a5a',
                    onChange: function (e) { onChange({ background: e.target.value }); } })
            ),
            el(PropRow, { label: __('Textfarbe', 'legacy-popups'), id: 'lp-prop-bcolor' },
                el('input', { id: 'lp-prop-bcolor', type: 'color', className: 'lp-prop-input lp-prop-input--color', value: p.color || '#ffffff',
                    onChange: function (e) { onChange({ color: e.target.value }); } })
            ),
            el(PropRow, { label: __('Schriftgröße (px)', 'legacy-popups'), id: 'lp-prop-bfs' },
                el('input', { id: 'lp-prop-bfs', type: 'number', className: 'lp-prop-input', value: p.fontSize || 14, min: 8, max: 48,
                    onChange: function (e) { onChange({ fontSize: parseInt(e.target.value, 10) || 14 }); } })
            ),
            el(PropRow, { label: __('Gewicht', 'legacy-popups'), id: 'lp-prop-bfw' },
                el('select', { id: 'lp-prop-bfw', className: 'lp-prop-input lp-prop-input--select', value: p.fontWeight || 600,
                    onChange: function (e) { onChange({ fontWeight: parseInt(e.target.value, 10) }); } },
                    el('option', { value: 400 }, __('Normal', 'legacy-popups')),
                    el('option', { value: 500 }, __('Medium', 'legacy-popups')),
                    el('option', { value: 600 }, __('Halbfett', 'legacy-popups')),
                    el('option', { value: 700 }, __('Fett', 'legacy-popups'))
                )
            ),
            el(PropRow, { label: __('Eckenradius (px)', 'legacy-popups'), id: 'lp-prop-br' },
                el('input', { id: 'lp-prop-br', type: 'number', className: 'lp-prop-input', value: p.borderRadius || 8, min: 0, max: 60,
                    onChange: function (e) { onChange({ borderRadius: parseInt(e.target.value, 10) || 0 }); } })
            ),
            el(PropRow, { label: __('Innenabstand X (px)', 'legacy-popups'), id: 'lp-prop-bpx' },
                el('input', { id: 'lp-prop-bpx', type: 'number', className: 'lp-prop-input', value: p.paddingX || 24, min: 4, max: 80,
                    onChange: function (e) { onChange({ paddingX: parseInt(e.target.value, 10) || 24 }); } })
            ),
            el(PropRow, { label: __('Innenabstand Y (px)', 'legacy-popups'), id: 'lp-prop-bpy' },
                el('input', { id: 'lp-prop-bpy', type: 'number', className: 'lp-prop-input', value: p.paddingY || 10, min: 2, max: 40,
                    onChange: function (e) { onChange({ paddingY: parseInt(e.target.value, 10) || 10 }); } })
            ),
            el(SegmentedRow, {
                label: __('Breite', 'legacy-popups'),
                value: p.width || 'auto',
                options: [
                    { value: 'auto', label: __('Auto', 'legacy-popups') },
                    { value: 'full', label: __('Voll', 'legacy-popups') }
                ],
                onChange: function (v) { onChange({ width: v }); }
            }),
            el(PropRow, { label: __('Schatten', 'legacy-popups'), id: 'lp-prop-bshadow' },
                el('label', { className: 'lp-prop-toggle' },
                    el('input', { type: 'checkbox', checked: !!p.shadow,
                        onChange: function (e) { onChange({ shadow: e.target.checked }); } }),
                    el('span', { className: 'lp-prop-toggle__track' })
                )
            )
        );
    }

    function BuilderPropertiesSpacer(props) {
        var p = props.nodeProps;
        var onChange = props.onChange;

        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, __('Abstand', 'legacy-popups')),
            el(PropRow, { label: __('Hoehe (px)', 'legacy-popups'), id: 'lp-prop-sheight' },
                el('input', { id: 'lp-prop-sheight', type: 'number', className: 'lp-prop-input', value: p.height || 24, min: 4, max: 400,
                    onChange: function (e) { onChange({ height: parseInt(e.target.value, 10) || 24 }); } })
            )
        );
    }

    function BuilderPropertiesUnsupported(props) {
        return el('div', { className: 'lp-prop-group' },
            el('p', { className: 'lp-prop-group__title' }, props.type),
            el('p', { className: 'lp-builder__unsupported-note' }, __('Dieser Node-Typ wird migrationssicher erhalten, kann in dieser Builder-Version aber noch nicht bearbeitet werden.', 'legacy-popups'))
        );
    }

    function BuilderProperties(props) {
        var schema         = props.schema;
        var selectedNodeId = props.selectedNodeId;
        var onUpdateNode   = props.onUpdateNode;
        var onUpdateLayout = props.onUpdateLayout;

        var selectedNode = selectedNodeId
            ? schema.nodes.find(function (n) { return n.id === selectedNodeId; })
            : null;

        return el('aside', { className: 'lp-builder__inspector' },
            el('div', { className: 'lp-builder__inspector-header' },
                el('p', { className: 'lp-builder__section-label' },
                    selectedNode
                        ? __('Eigenschaften', 'legacy-popups') + ': ' + selectedNode.type
                        : __('Popup-Container', 'legacy-popups')
                )
            ),
            selectedNode === null
                ? el(BuilderPropertiesContainer, {
                    layout: schema.layout,
                    onChange: onUpdateLayout
                  })
                : null,
            selectedNode && selectedNode.type === 'text'
                ? el(BuilderPropertiesText, {
                    nodeProps: selectedNode.props,
                    onChange: function (p) { onUpdateNode(selectedNode.id, p); }
                  })
                : null,
            selectedNode && selectedNode.type === 'image'
                ? el(BuilderPropertiesImage, {
                    nodeProps: selectedNode.props,
                    onChange: function (p) { onUpdateNode(selectedNode.id, p); }
                  })
                : null,
            selectedNode && selectedNode.type === 'button'
                ? el(BuilderPropertiesButton, {
                    nodeProps: selectedNode.props,
                    onChange: function (p) { onUpdateNode(selectedNode.id, p); }
                  })
                : null,
            selectedNode && selectedNode.type === 'spacer'
                ? el(BuilderPropertiesSpacer, {
                    nodeProps: selectedNode.props,
                    onChange: function (p) { onUpdateNode(selectedNode.id, p); }
                  })
                : null,
            selectedNode && ['text', 'image', 'button', 'spacer'].indexOf(selectedNode.type) === -1
                ? el(BuilderPropertiesUnsupported, {
                    type: selectedNode.type
                  })
                : null
        );
    }

    function BuilderPreviewModal(props) {
        if (!props.isOpen) {
            return null;
        }

        return el('div', { className: 'lp-preview-modal', role: 'dialog', 'aria-modal': true },
            el('button', {
                type: 'button',
                className: 'lp-preview-modal__backdrop',
                'aria-label': __('Vorschau schliessen', 'legacy-popups'),
                onClick: props.onClose
            }),
            el('div', { className: 'lp-preview-modal__panel' },
                el('div', { className: 'lp-preview-modal__header' },
                    el('div', null,
                        el('p', { className: 'lp-builder__section-label' }, __('Backend-Vorschau', 'legacy-popups')),
                        el('p', { className: 'lp-preview-modal__hint' }, __('Der Iframe laedt dieselbe gesicherte Frontend-Vorschau, die auch in einem neuen Tab verfuegbar ist.', 'legacy-popups'))
                    ),
                    el('div', { className: 'lp-preview-modal__actions' },
                        el('button', {
                            type: 'button',
                            className: 'lp-btn lp-btn--ghost lp-btn--sm',
                            onClick: props.onOpenInNewTab,
                            disabled: !props.url
                        },
                            el(Icon, { name: 'eye', stroke: true, size: 14 }),
                            __('Im Frontend oeffnen', 'legacy-popups')
                        ),
                        el('button', {
                            type: 'button',
                            className: 'lp-btn lp-btn--ghost lp-btn--sm',
                            onClick: props.onClose
                        },
                            el(Icon, { name: 'close', stroke: true, size: 14 }),
                            __('Schliessen', 'legacy-popups')
                        )
                    )
                ),
                el('div', { className: 'lp-preview-modal__body' },
                    props.isLoading
                        ? el('div', { className: 'lp-preview-modal__status' },
                            el(Icon, { name: 'refresh', stroke: true, size: 18, className: 'lp-spin' }),
                            el('span', null, __('Vorschau wird vorbereitet…', 'legacy-popups'))
                        )
                        : props.url
                            ? el('iframe', {
                                title: __('Popup-Vorschau', 'legacy-popups'),
                                className: 'lp-preview-modal__iframe',
                                src: props.url
                            })
                            : el('div', { className: 'lp-preview-modal__status' },
                                el(Icon, { name: 'eye', stroke: true, size: 18 }),
                                el('span', null, __('Noch keine Vorschau verfuegbar.', 'legacy-popups'))
                            )
                )
            )
        );
    }

    // --- BuilderView ---

    function TemplateMockButton(preview) {
        return el('span', {
            className: 'lp-template-mock__cta',
            style: {
                background: preview.accent,
                color: preview.variant === 'card' && preview.accent === '#f4b134' ? '#0e1620' : '#ffffff'
            }
        }, preview.cta);
    }

    function TemplateMockTag(preview) {
        if (!preview.tag) {
            return null;
        }

        return el('span', {
            className: 'lp-template-mock__tag',
            style: { color: preview.accent, borderColor: preview.accent }
        }, preview.tag);
    }

    function TemplateMock(props) {
        var preview = props.preview;
        var alignClass = ' lp-template-mock--align-' + (preview.align || 'center');
        var variant = preview.variant || 'card';
        var bg = preview.background || '#ffffff';
        var textColor = preview.textColor || '#1a1a1d';

        if (variant === 'bar') {
            return el('div', { className: 'lp-template-mock lp-template-mock--bar' + alignClass },
                el('div', {
                    className: 'lp-template-mock__bar',
                    style: { background: bg, color: textColor }
                },
                    el('div', { className: 'lp-template-mock__bar-text' },
                        el('span', { className: 'lp-template-mock__title-bar' }, preview.headline),
                        preview.sub ? el('span', { className: 'lp-template-mock__sub-bar' }, preview.sub) : null
                    ),
                    TemplateMockButton(preview)
                )
            );
        }

        var positionClass = variant === 'corner' ? ' lp-template-mock--corner' : '';

        return el('div', { className: 'lp-template-mock' + alignClass + positionClass },
            el('div', {
                className: 'lp-template-mock__card',
                style: { background: bg, color: textColor, borderColor: variant === 'corner' ? 'transparent' : 'rgba(0,0,0,0.05)' }
            },
                TemplateMockTag(preview),
                el('p', { className: 'lp-template-mock__title' }, preview.headline),
                preview.sub ? el('p', { className: 'lp-template-mock__sub' }, preview.sub) : null,
                TemplateMockButton(preview)
            )
        );
    }

    function TemplateGalleryModal(props) {
        if (!props.isOpen) {
            return null;
        }

        var categoryState = useState('all');
        var category = categoryState[0];
        var setCategory = categoryState[1];
        var queryState = useState('');
        var query = queryState[0];
        var setQuery = queryState[1];

        var normalizedQuery = (query || '').trim().toLowerCase();
        var visible = BUILDER_TEMPLATES.filter(function (template) {
            if (category !== 'all' && template.category !== category) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            return (template.name + ' ' + (template.description || '')).toLowerCase().indexOf(normalizedQuery) !== -1;
        });

        function handleApply(template) {
            if (typeof props.onApply === 'function') {
                props.onApply(template);
            }
        }

        return el('div', { className: 'lp-templates-modal', role: 'dialog', 'aria-modal': true },
            el('button', {
                type: 'button',
                className: 'lp-templates-modal__backdrop',
                'aria-label': __('Vorlagen schliessen', 'legacy-popups'),
                onClick: props.onClose
            }),
            el('div', { className: 'lp-templates-modal__panel' },
                el('div', { className: 'lp-templates-modal__header' },
                    el('div', null,
                        el('p', { className: 'lp-templates-modal__eyebrow' },
                            el(Icon, { name: 'sparkles', stroke: true, size: 14 }),
                            __('Vorlagenbibliothek', 'legacy-popups')
                        ),
                        el('h2', { className: 'lp-templates-modal__title' }, __('Inspirierende Presets fuer dein naechstes Popup', 'legacy-popups')),
                        el('p', { className: 'lp-templates-modal__hint' }, __('Waehle ein Layout und passe Texte, Farben und Trigger an. Deine bisherigen Inhalte werden ersetzt.', 'legacy-popups'))
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--ghost lp-btn--sm',
                        onClick: props.onClose
                    },
                        el(Icon, { name: 'close', stroke: true, size: 14 }),
                        __('Schliessen', 'legacy-popups')
                    )
                ),
                el('div', { className: 'lp-templates-modal__filters' },
                    el('div', { className: 'lp-templates-modal__chips' },
                        TEMPLATE_CATEGORIES.map(function (cat) {
                            return el('button', {
                                key: cat.id,
                                type: 'button',
                                className: 'lp-templates-chip' + (category === cat.id ? ' is-active' : ''),
                                onClick: function () { setCategory(cat.id); }
                            }, __(cat.label, 'legacy-popups'));
                        })
                    ),
                    el('div', { className: 'lp-templates-modal__search' },
                        el(Icon, { name: 'search', stroke: true, size: 14, className: 'lp-templates-modal__search-icon' }),
                        el('input', {
                            type: 'search',
                            value: query,
                            placeholder: __('Vorlagen suchen…', 'legacy-popups'),
                            onChange: function (event) { setQuery(event.target.value); }
                        })
                    )
                ),
                el('div', { className: 'lp-templates-modal__body' },
                    !visible.length
                        ? el('div', { className: 'lp-templates-modal__empty' },
                            el(Icon, { name: 'sparkles', stroke: true, size: 22 }),
                            el('p', null, __('Keine Vorlagen passen zum Filter.', 'legacy-popups'))
                        )
                        : el('div', { className: 'lp-templates-grid' },
                            visible.map(function (template) {
                                return el('article', {
                                    key: template.id,
                                    className: 'lp-template-card',
                                    style: { '--lp-template-accent': template.accent || '#0f6a5a' }
                                },
                                    el('div', { className: 'lp-template-card__preview' },
                                        el(TemplateMock, { preview: template.preview })
                                    ),
                                    el('div', { className: 'lp-template-card__body' },
                                        el('div', { className: 'lp-template-card__meta' },
                                            el('span', { className: 'lp-template-card__category' }, __(categoryLabelFor(template.category), 'legacy-popups')),
                                            el('span', { className: 'lp-template-card__dot', 'aria-hidden': true })
                                        ),
                                        el('h3', { className: 'lp-template-card__title' }, template.name),
                                        el('p', { className: 'lp-template-card__desc' }, template.description),
                                        el('button', {
                                            type: 'button',
                                            className: 'lp-btn lp-btn--primary lp-btn--sm lp-template-card__apply',
                                            onClick: function () { handleApply(template); }
                                        },
                                            el(Icon, { name: 'sparkles', stroke: true, size: 14 }),
                                            __('Vorlage uebernehmen', 'legacy-popups')
                                        )
                                    )
                                );
                            })
                        )
                )
            )
        );
    }

    function categoryLabelFor(id) {
        for (var i = 0; i < TEMPLATE_CATEGORIES.length; i++) {
            if (TEMPLATE_CATEGORIES[i].id === id) {
                return TEMPLATE_CATEGORIES[i].label;
            }
        }
        return id;
    }

    function BuilderView(props) {
        var popups = props.popups || [];
        var bs = useBuilderState({
            popups: popups,
            onCreatePopup: props.onCreatePopup,
            onAfterSave: props.onAfterSave
        });

        var viewportState = useState('desktop');
        var viewport    = viewportState[0];
        var setViewport = viewportState[1];
        var previewOpenState = useState(false);
        var isPreviewOpen = previewOpenState[0];
        var setIsPreviewOpen = previewOpenState[1];
        var previewUrlState = useState('');
        var previewUrl = previewUrlState[0];
        var setPreviewUrl = previewUrlState[1];
        var previewLoadingState = useState(false);
        var isPreviewLoading = previewLoadingState[0];
        var setIsPreviewLoading = previewLoadingState[1];

        var templatesOpenState = useState(false);
        var isTemplatesOpen = templatesOpenState[0];
        var setIsTemplatesOpen = templatesOpenState[1];

        function openTemplates() {
            setIsTemplatesOpen(true);
        }

        function closeTemplates() {
            setIsTemplatesOpen(false);
        }

        function handleApplyTemplate(template) {
            bs.applyTemplate(template);
            setIsTemplatesOpen(false);
        }

        var vpLabels = {
            desktop: __('Desktop', 'legacy-popups'),
            tablet:  __('Tablet (768 px)', 'legacy-popups'),
            mobile:  __('Mobile (375 px)', 'legacy-popups')
        };
        var selectedPopup = popups.find(function (popup) {
            return popup.id === bs.activePopupId;
        }) || null;
        var selectedPreviewUrl = selectedPopup && selectedPopup.preview_url ? selectedPopup.preview_url : '';

        useEffect(function () {
            setIsPreviewOpen(false);
            setPreviewUrl('');
            setIsPreviewLoading(false);
        }, [bs.activePopupId]);

        function withReadyPreviewUrl() {
            if (!bs.activePopupId) {
                return Promise.resolve('');
            }

            if (!bs.isDirty) {
                return Promise.resolve(selectedPreviewUrl);
            }

            return bs.savePopup().then(function (popup) {
                return popup && popup.preview_url ? popup.preview_url : '';
            });
        }

        function openPreviewModal() {
            setIsPreviewLoading(true);

            withReadyPreviewUrl().then(function (url) {
                if (!url) {
                    return;
                }

                setPreviewUrl(url);
                setIsPreviewOpen(true);
            }).finally(function () {
                setIsPreviewLoading(false);
            });
        }

        function openPreviewInNewTab() {
            setIsPreviewLoading(true);

            withReadyPreviewUrl().then(function (url) {
                if (!url) {
                    return;
                }

                setPreviewUrl(url);
                window.open(url, '_blank', 'noopener');
            }).finally(function () {
                setIsPreviewLoading(false);
            });
        }

        var notices = [];

        if (bs.errorMessage) {
            notices.push(el(Notice, {
                key: 'builder-error',
                type: 'error',
                message: bs.errorMessage,
                onDismiss: bs.dismissMessage
            }));
        }

        if (!bs.errorMessage && bs.noticeMessage) {
            notices.push(el(Notice, {
                key: 'builder-notice',
                type: 'success',
                message: bs.noticeMessage,
                onDismiss: bs.dismissMessage
            }));
        }

        return el('div', { className: 'lp-builder' },
            el('div', { className: 'lp-builder-topbar' },
                el('div', { className: 'lp-builder-topbar__left' },
                    el(Icon, { name: 'builder', stroke: true, size: 16 }),
                    el('select', {
                        className: 'lp-builder-topbar__popup-select',
                        value: bs.activePopupId || '',
                        onChange: function (event) { bs.selectPopup(event.target.value); },
                        disabled: !popups.length || bs.isLoadingPopup || bs.isSavingPopup
                    },
                        !popups.length
                            ? el('option', { value: '' }, __('Keine Popups vorhanden', 'legacy-popups'))
                            : popups.map(function (popup) {
                                return el('option', { key: popup.id, value: popup.id }, popup.title || __('Ohne Titel', 'legacy-popups'));
                            })
                    ),
                    el('input', {
                        type: 'text',
                        className: 'lp-builder-topbar__title-input',
                        value: bs.popupTitle,
                        'aria-label': __('Popup-Titel', 'legacy-popups'),
                        disabled: !bs.activePopupId || bs.isLoadingPopup,
                        onChange: function (e) { bs.setPopupTitle(e.target.value); }
                    })
                ),
                el('div', { className: 'lp-builder-topbar__right' },
                    el('div', { className: 'lp-builder-viewport-toggle' },
                        ['desktop', 'tablet', 'mobile'].map(function (vp) {
                            return el('button', {
                                key: vp,
                                type: 'button',
                                className: 'lp-builder-viewport-btn' + (viewport === vp ? ' is-active' : ''),
                                title: vpLabels[vp],
                                onClick: function () { setViewport(vp); }
                            }, el(Icon, { name: vp, stroke: true, size: 15 }));
                        })
                    ),
                    el('span', { className: 'lp-builder-meta-pill' }, __('Schema v', 'legacy-popups') + String(BUILDER_SCHEMA_VERSION)),
                    bs.isDirty
                        ? el('span', { className: 'lp-builder-saved-pill lp-builder-saved-pill--unsaved' }, __('Ungespeichert', 'legacy-popups'))
                        : el('span', { className: 'lp-builder-saved-pill' }, __('Gespeichert', 'legacy-popups')),
                    el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--ghost lp-btn--sm',
                        onClick: openTemplates
                    },
                        el(Icon, { name: 'sparkles', stroke: true, size: 14 }),
                        __('Vorlagen', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--ghost lp-btn--sm',
                        disabled: !bs.activePopupId || bs.isLoadingPopup || bs.isSavingPopup || isPreviewLoading,
                        onClick: openPreviewModal
                    },
                        el(Icon, { name: 'eye', stroke: true, size: 14 }),
                        isPreviewLoading ? __('Bereite Vorschau vor…', 'legacy-popups') : __('Vorschau', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--ghost lp-btn--sm',
                        disabled: bs.isCreatingPopup,
                        onClick: bs.createPopup
                    },
                        el(Icon, { name: 'plus', stroke: true, size: 14 }),
                        bs.isCreatingPopup ? __('Erstelle…', 'legacy-popups') : __('Neues Popup', 'legacy-popups')
                    ),
                    el('button', {
                        type: 'button',
                        className: 'lp-btn lp-btn--primary lp-btn--sm',
                        disabled: !bs.activePopupId || bs.isSavingPopup || bs.isLoadingPopup,
                        onClick: bs.savePopup
                    },
                        el(Icon, { name: 'plus', stroke: true, size: 14 }),
                        bs.isSavingPopup ? __('Speichere…', 'legacy-popups') : __('Speichern', 'legacy-popups')
                    )
                )
            ),
            notices.length
                ? el('div', { className: 'lp-builder__notice-strip' }, notices)
                : null,
            el('div', { className: 'lp-builder__body' },
                !popups.length
                    ? el('div', { className: 'lp-builder__blank-state' },
                        el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'builder', stroke: true, size: 28 })),
                        el('p', { className: 'lp-empty__title' }, __('Noch kein Popup vorhanden', 'legacy-popups')),
                        el('p', { className: 'lp-empty__lede' }, __('Lege zuerst ein Popup an, damit du Schema, Nodes und Layout persistent bearbeiten kannst.', 'legacy-popups')),
                        el('button', {
                            type: 'button',
                            className: 'lp-btn lp-btn--primary',
                            disabled: bs.isCreatingPopup,
                            onClick: bs.createPopup
                        },
                            el(Icon, { name: 'plus', stroke: true, size: 16 }),
                            bs.isCreatingPopup ? __('Erstelle…', 'legacy-popups') : __('Popup anlegen', 'legacy-popups')
                        )
                    )
                    : bs.isLoadingPopup
                        ? el('div', { className: 'lp-builder__blank-state' },
                            el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'refresh', stroke: true, size: 28, className: 'lp-spin' })),
                            el('p', { className: 'lp-empty__title' }, __('Popup wird geladen', 'legacy-popups')),
                            el('p', { className: 'lp-empty__lede' }, __('Schema und Eigenschaften werden aus der REST-API geladen.', 'legacy-popups'))
                        )
                        : [
                            el(BuilderSidebar, { key: 'builder-sidebar', onAdd: bs.addNode, onOpenTemplates: openTemplates }),
                            el(BuilderCanvas, {
                                key: 'builder-canvas',
                                schema: bs.schema,
                                selectedNodeId: bs.selectedNodeId,
                                viewport: viewport,
                                onSelectNode: bs.selectNode,
                                onRemoveNode: bs.removeNode,
                                onMoveNode: bs.moveNode
                            }),
                            el(BuilderProperties, {
                                key: 'builder-properties',
                                schema: bs.schema,
                                selectedNodeId: bs.selectedNodeId,
                                onUpdateNode: bs.updateNode,
                                onUpdateLayout: bs.updateLayout
                            })
                        ]
            ),
            el(BuilderPreviewModal, {
                isOpen: isPreviewOpen,
                isLoading: isPreviewLoading,
                url: previewUrl,
                onClose: function () { setIsPreviewOpen(false); },
                onOpenInNewTab: openPreviewInNewTab
            }),
            el(TemplateGalleryModal, {
                isOpen: isTemplatesOpen,
                onClose: closeTemplates,
                onApply: handleApplyTemplate
            })
        );
    }

    function useStatsDashboard() {
        var rangeState = useState(function () {
            return Object.assign({ preset: '30d' }, rangeForPreset('30d'));
        });
        var range = rangeState[0];
        var setRange = rangeState[1];

        var popupsState = useState([]);
        var popups = popupsState[0];
        var setPopups = popupsState[1];

        var loadingState = useState(true);
        var isLoading = loadingState[0];
        var setIsLoading = loadingState[1];

        var errorState = useState('');
        var error = errorState[0];
        var setError = errorState[1];

        var summariesState = useState({});
        var summaries = summariesState[0];
        var setSummaries = summariesState[1];

        var selectedState = useState('all');
        var selectedPopupId = selectedState[0];
        var setSelectedPopupId = selectedState[1];

        var rankingMetricState = useState('impressions');
        var rankingMetric = rankingMetricState[0];
        var setRankingMetric = rankingMetricState[1];

        useEffect(function () {
            var cancelled = false;
            setIsLoading(true);
            setError('');

            PopupApi.list({ search: '', popupStatus: '' })
                .then(function (response) {
                    if (cancelled) {
                        return null;
                    }
                    var items = (response && response.items) || [];
                    setPopups(items);

                    if (!items.length) {
                        setSummaries({});
                        return null;
                    }

                    return Promise.all(items.map(function (popup) {
                        return AnalyticsApi.summary(popup.id, range.from, range.to)
                            .then(function (summary) { return { id: popup.id, summary: summary }; })
                            .catch(function () { return { id: popup.id, summary: null }; });
                    })).then(function (results) {
                        if (cancelled) {
                            return;
                        }
                        var map = {};
                        results.forEach(function (entry) {
                            if (entry && entry.summary) {
                                map[entry.id] = entry.summary;
                            }
                        });
                        setSummaries(map);
                    });
                })
                .catch(function (err) {
                    if (!cancelled) {
                        setError(err && err.message ? err.message : __('Statistik konnte nicht geladen werden.', 'legacy-popups'));
                    }
                })
                .then(function () {
                    if (!cancelled) {
                        setIsLoading(false);
                    }
                });

            return function () { cancelled = true; };
        }, [range.from, range.to]);

        function applyPreset(preset) {
            setRange(Object.assign({ preset: preset }, rangeForPreset(preset)));
        }

        function setCustomRange(field, value) {
            setRange(function (current) {
                var next = Object.assign({}, current, { preset: 'custom' });
                next[field] = value;
                if (next.from && next.to && parseIsoDate(next.from) > parseIsoDate(next.to)) {
                    if (field === 'from') {
                        next.to = next.from;
                    } else {
                        next.from = next.to;
                    }
                }
                return next;
            });
        }

        return {
            range: range,
            popups: popups,
            summaries: summaries,
            isLoading: isLoading,
            error: error,
            selectedPopupId: selectedPopupId,
            setSelectedPopupId: setSelectedPopupId,
            rankingMetric: rankingMetric,
            setRankingMetric: setRankingMetric,
            applyPreset: applyPreset,
            setCustomRange: setCustomRange
        };
    }

    function aggregateSummaries(summaries, fromIso, toIso) {
        var totals = { impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 };
        var byDate = {};
        var days = enumerateDays(fromIso, toIso);

        days.forEach(function (date) {
            byDate[date] = { date: date, impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 };
        });

        Object.keys(summaries).forEach(function (popupId) {
            var summary = summaries[popupId];
            if (!summary) {
                return;
            }
            var t = summary.totals || {};
            totals.impressions += Number(t.impressions || 0);
            totals.unique_impressions += Number(t.unique_impressions || 0);
            totals.closes += Number(t.closes || 0);
            totals.clicks += Number(t.clicks || 0);
            totals.conversions += Number(t.conversions || 0);

            (summary.days || []).forEach(function (day) {
                if (!byDate[day.date]) {
                    byDate[day.date] = { date: day.date, impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 };
                }
                byDate[day.date].impressions += Number(day.impressions || 0);
                byDate[day.date].unique_impressions += Number(day.unique_impressions || 0);
                byDate[day.date].closes += Number(day.closes || 0);
                byDate[day.date].clicks += Number(day.clicks || 0);
                byDate[day.date].conversions += Number(day.conversions || 0);
            });
        });

        var orderedDays = Object.keys(byDate).sort().map(function (key) { return byDate[key]; });

        return { totals: totals, days: orderedDays };
    }

    function StatsKpi(props) {
        return el('div', { className: 'lp-kpi' + (props.accent ? ' lp-kpi--accent' : '') },
            el('span', { className: 'lp-kpi__label' }, props.label),
            el('span', { className: 'lp-kpi__value' }, props.value),
            props.hint ? el('span', { className: 'lp-kpi__hint' }, props.hint) : null
        );
    }

    var STATS_SERIES = [
        { key: 'impressions', label: __('Impressionen', 'legacy-popups'), color: '#0f6a5a' },
        { key: 'clicks', label: __('Klicks', 'legacy-popups'), color: '#c47b1a' },
        { key: 'conversions', label: __('Conversions', 'legacy-popups'), color: '#2a4d8f' }
    ];

    function StatsTimeseries(props) {
        var days = props.days || [];
        var width = 880;
        var height = 260;
        var paddingLeft = 44;
        var paddingRight = 16;
        var paddingTop = 16;
        var paddingBottom = 32;

        var maxValue = 0;
        days.forEach(function (day) {
            STATS_SERIES.forEach(function (series) {
                if (Number(day[series.key]) > maxValue) {
                    maxValue = Number(day[series.key]);
                }
            });
        });
        if (maxValue < 4) {
            maxValue = 4;
        }
        // round up to "nice" value
        var magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1));
        maxValue = Math.ceil(maxValue / magnitude) * magnitude;

        var innerWidth = width - paddingLeft - paddingRight;
        var innerHeight = height - paddingTop - paddingBottom;
        var stepX = days.length > 1 ? innerWidth / (days.length - 1) : 0;

        function pointFor(index, value) {
            var x = paddingLeft + (days.length > 1 ? index * stepX : innerWidth / 2);
            var y = paddingTop + innerHeight - (Number(value || 0) / maxValue) * innerHeight;
            return { x: x, y: y };
        }

        var gridLines = [0, 0.25, 0.5, 0.75, 1].map(function (ratio, idx) {
            var y = paddingTop + innerHeight * (1 - ratio);
            var label = formatNumber(Math.round(maxValue * ratio));
            return el(Fragment, { key: 'g' + idx },
                el('line', {
                    x1: paddingLeft, x2: width - paddingRight,
                    y1: y, y2: y,
                    stroke: '#e6dfd1', strokeWidth: 1, strokeDasharray: idx === 0 ? '0' : '3 4'
                }),
                el('text', {
                    x: paddingLeft - 8, y: y + 4,
                    fontSize: 10, textAnchor: 'end', fill: '#8a8170'
                }, label)
            );
        });

        var xLabels = [];
        if (days.length) {
            var maxLabels = 7;
            var step = Math.max(1, Math.ceil(days.length / maxLabels));
            for (var i = 0; i < days.length; i += step) {
                var p = pointFor(i, 0);
                xLabels.push(el('text', {
                    key: 'x' + i,
                    x: p.x, y: height - paddingBottom + 18,
                    fontSize: 10, textAnchor: 'middle', fill: '#8a8170'
                }, formatShortDate(days[i].date)));
            }
        }

        var seriesPaths = STATS_SERIES.map(function (series) {
            var path = '';
            var area = '';
            days.forEach(function (day, index) {
                var pt = pointFor(index, day[series.key]);
                path += (index === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ' ';
            });
            if (days.length) {
                var first = pointFor(0, days[0][series.key]);
                var last = pointFor(days.length - 1, days[days.length - 1][series.key]);
                var baseY = paddingTop + innerHeight;
                area = 'M' + first.x.toFixed(1) + ' ' + baseY.toFixed(1) + ' '
                    + path.replace(/^M/, 'L')
                    + 'L' + last.x.toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
            }
            return el(Fragment, { key: series.key },
                area ? el('path', { d: area, fill: series.color, opacity: 0.08 }) : null,
                el('path', {
                    d: path, fill: 'none', stroke: series.color,
                    strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round'
                }),
                days.map(function (day, index) {
                    var pt = pointFor(index, day[series.key]);
                    return el('circle', {
                        key: series.key + '-' + index,
                        cx: pt.x, cy: pt.y, r: 2.6,
                        fill: '#fff', stroke: series.color, strokeWidth: 1.6
                    });
                })
            );
        });

        if (!days.length) {
            return el('div', { className: 'lp-stats-chart__empty' },
                __('Keine Datenpunkte fuer diesen Zeitraum.', 'legacy-popups')
            );
        }

        return el('div', { className: 'lp-stats-chart' },
            el('div', { className: 'lp-stats-chart__legend' },
                STATS_SERIES.map(function (series) {
                    return el('span', { key: series.key, className: 'lp-stats-chart__legend-item' },
                        el('span', { className: 'lp-stats-chart__swatch', style: { background: series.color } }),
                        series.label
                    );
                })
            ),
            el('svg', {
                className: 'lp-stats-chart__svg',
                viewBox: '0 0 ' + width + ' ' + height,
                preserveAspectRatio: 'xMidYMid meet',
                role: 'img',
                'aria-label': __('Zeitreihe Impressionen, Klicks, Conversions', 'legacy-popups')
            }, gridLines, seriesPaths, xLabels)
        );
    }

    function StatsRanking(props) {
        var popups = props.popups || [];
        var summaries = props.summaries || {};
        var metric = props.metric;

        var rows = popups.map(function (popup) {
            var summary = summaries[popup.id];
            var totals = (summary && summary.totals) || { impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 };
            return {
                id: popup.id,
                title: popup.title || __('Unbenanntes Popup', 'legacy-popups'),
                status: popup.popup_status,
                impressions: totals.impressions || 0,
                unique_impressions: totals.unique_impressions || 0,
                closes: totals.closes || 0,
                clicks: totals.clicks || 0,
                conversions: totals.conversions || 0,
                ctr: safeRate(totals.clicks, totals.impressions),
                conversionRate: safeRate(totals.conversions, totals.impressions),
                closeRate: safeRate(totals.closes, totals.impressions)
            };
        });

        rows.sort(function (a, b) {
            return Number(b[metric] || 0) - Number(a[metric] || 0);
        });

        if (!rows.length) {
            return el('div', { className: 'lp-empty lp-empty--compact' },
                el('p', { className: 'lp-empty__title' }, __('Noch keine Popups vorhanden.', 'legacy-popups'))
            );
        }

        var maxValue = Math.max.apply(null, rows.map(function (row) { return Number(row[metric] || 0); }));
        if (!maxValue) {
            maxValue = 1;
        }

        return el('div', { className: 'lp-stats-ranking' },
            el('table', { className: 'lp-stats-ranking__table' },
                el('thead', null,
                    el('tr', null,
                        el('th', null, __('Popup', 'legacy-popups')),
                        el('th', null, __('Impressionen', 'legacy-popups')),
                        el('th', null, __('Klicks', 'legacy-popups')),
                        el('th', null, __('Conversions', 'legacy-popups')),
                        el('th', null, __('CTR', 'legacy-popups')),
                        el('th', null, __('CR', 'legacy-popups'))
                    )
                ),
                el('tbody', null,
                    rows.map(function (row) {
                        var widthPct = Math.max(2, Math.round((Number(row[metric] || 0) / maxValue) * 100));
                        return el('tr', { key: row.id, className: row.id === props.selectedPopupId ? 'is-active' : '' },
                            el('td', null,
                                el('div', { className: 'lp-stats-ranking__title-cell' },
                                    el('button', {
                                        type: 'button',
                                        className: 'lp-stats-ranking__title',
                                        onClick: function () { props.onSelect(row.id); }
                                    }, row.title),
                                    el('div', { className: 'lp-stats-ranking__bar' },
                                        el('span', { className: 'lp-stats-ranking__bar-fill', style: { width: widthPct + '%' } })
                                    )
                                )
                            ),
                            el('td', null, formatNumber(row.impressions)),
                            el('td', null, formatNumber(row.clicks)),
                            el('td', null, formatNumber(row.conversions)),
                            el('td', null, formatPercent(row.ctr)),
                            el('td', null, formatPercent(row.conversionRate))
                        );
                    })
                )
            )
        );
    }

    function StatsView() {
        var dash = useStatsDashboard();
        var range = dash.range;
        var popups = dash.popups;
        var summaries = dash.summaries;

        var aggregated = aggregateSummaries(summaries, range.from, range.to);

        var view;
        if (dash.selectedPopupId === 'all') {
            view = aggregated;
        } else {
            var single = summaries[dash.selectedPopupId];
            if (single) {
                var dayMap = {};
                enumerateDays(range.from, range.to).forEach(function (date) {
                    dayMap[date] = { date: date, impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 };
                });
                (single.days || []).forEach(function (day) { dayMap[day.date] = Object.assign(dayMap[day.date] || { date: day.date }, day); });
                view = {
                    totals: single.totals || { impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 },
                    days: Object.keys(dayMap).sort().map(function (key) { return dayMap[key]; })
                };
            } else {
                view = { totals: { impressions: 0, unique_impressions: 0, closes: 0, clicks: 0, conversions: 0 }, days: [] };
            }
        }

        var totals = view.totals;
        var ctr = safeRate(totals.clicks, totals.impressions);
        var conversionRate = safeRate(totals.conversions, totals.impressions);
        var closeRate = safeRate(totals.closes, totals.impressions);

        var presets = [
            { id: 'today', label: __('Heute', 'legacy-popups') },
            { id: '7d', label: __('7 Tage', 'legacy-popups') },
            { id: '30d', label: __('30 Tage', 'legacy-popups') },
            { id: '90d', label: __('90 Tage', 'legacy-popups') }
        ];

        return el(Fragment, null,
            el('div', { className: 'lp-stats-toolbar' },
                el('div', { className: 'lp-stats-toolbar__left' },
                    el('div', { className: 'lp-stats-presets', role: 'tablist', 'aria-label': __('Zeitraum', 'legacy-popups') },
                        presets.map(function (preset) {
                            return el('button', {
                                key: preset.id,
                                type: 'button',
                                className: 'lp-stats-preset' + (range.preset === preset.id ? ' is-active' : ''),
                                onClick: function () { dash.applyPreset(preset.id); },
                                'aria-pressed': range.preset === preset.id
                            }, preset.label);
                        })
                    ),
                    el('div', { className: 'lp-stats-daterange' },
                        el('label', { className: 'lp-stats-daterange__field' },
                            el('span', null, __('Von', 'legacy-popups')),
                            el('input', {
                                type: 'date',
                                value: range.from,
                                max: range.to,
                                onChange: function (e) { dash.setCustomRange('from', e.target.value); }
                            })
                        ),
                        el('label', { className: 'lp-stats-daterange__field' },
                            el('span', null, __('Bis', 'legacy-popups')),
                            el('input', {
                                type: 'date',
                                value: range.to,
                                min: range.from,
                                onChange: function (e) { dash.setCustomRange('to', e.target.value); }
                            })
                        )
                    )
                ),
                el('div', { className: 'lp-stats-toolbar__right' },
                    el('label', { className: 'lp-stats-popup-select' },
                        el('span', null, __('Popup', 'legacy-popups')),
                        el('select', {
                            value: dash.selectedPopupId,
                            onChange: function (e) {
                                var raw = e.target.value;
                                dash.setSelectedPopupId(raw === 'all' ? 'all' : Number(raw));
                            }
                        },
                            el('option', { value: 'all' }, __('Alle Popups (aggregiert)', 'legacy-popups')),
                            popups.map(function (popup) {
                                return el('option', { key: popup.id, value: popup.id },
                                    popup.title || __('Ohne Titel', 'legacy-popups'));
                            })
                        )
                    ),
                    dash.isLoading
                        ? el('span', { className: 'lp-stats-toolbar__status' },
                            el(Icon, { name: 'refresh', stroke: true, size: 14, className: 'lp-spin' }),
                            __('Lade…', 'legacy-popups'))
                        : null
                )
            ),
            dash.error
                ? el(Notice, { variant: 'error', message: dash.error, onDismiss: function () {} })
                : null,
            el('div', { className: 'lp-stats-kpis' },
                el(StatsKpi, {
                    accent: true,
                    label: __('Impressionen', 'legacy-popups'),
                    value: formatNumber(totals.impressions),
                    hint: __('Unique', 'legacy-popups') + ': ' + formatNumber(totals.unique_impressions)
                }),
                el(StatsKpi, {
                    label: __('Klicks', 'legacy-popups'),
                    value: formatNumber(totals.clicks),
                    hint: __('CTR', 'legacy-popups') + ': ' + formatPercent(ctr)
                }),
                el(StatsKpi, {
                    label: __('Conversions', 'legacy-popups'),
                    value: formatNumber(totals.conversions),
                    hint: __('CR', 'legacy-popups') + ': ' + formatPercent(conversionRate)
                }),
                el(StatsKpi, {
                    label: __('Schliessungen', 'legacy-popups'),
                    value: formatNumber(totals.closes),
                    hint: __('Schliess-Rate', 'legacy-popups') + ': ' + formatPercent(closeRate)
                })
            ),
            el('div', { className: 'lp-panel lp-stats-panel' },
                el('div', { className: 'lp-panel__header' },
                    el('div', null,
                        el('h3', { className: 'lp-panel__title' }, __('Zeitreihe', 'legacy-popups')),
                        el('p', { className: 'lp-panel__hint' },
                            formatShortDate(range.from) + ' – ' + formatShortDate(range.to)
                            + ' · ' + (dash.selectedPopupId === 'all'
                                ? __('Alle Popups', 'legacy-popups')
                                : __('Einzelnes Popup', 'legacy-popups'))
                        )
                    )
                ),
                el(StatsTimeseries, { days: view.days })
            ),
            el('div', { className: 'lp-panel lp-stats-panel' },
                el('div', { className: 'lp-panel__header' },
                    el('div', null,
                        el('h3', { className: 'lp-panel__title' }, __('Popup-Ranking', 'legacy-popups')),
                        el('p', { className: 'lp-panel__hint' }, __('Nach gewaehlter Metrik sortiert. Klick auf den Titel filtert die Auswertung.', 'legacy-popups'))
                    ),
                    el('div', { className: 'lp-stats-ranking__metric' },
                        ['impressions', 'clicks', 'conversions'].map(function (key) {
                            var label = key === 'impressions'
                                ? __('Impressionen', 'legacy-popups')
                                : key === 'clicks'
                                    ? __('Klicks', 'legacy-popups')
                                    : __('Conversions', 'legacy-popups');
                            return el('button', {
                                key: key,
                                type: 'button',
                                className: 'lp-stats-ranking__metric-btn' + (dash.rankingMetric === key ? ' is-active' : ''),
                                onClick: function () { dash.setRankingMetric(key); },
                                'aria-pressed': dash.rankingMetric === key
                            }, label);
                        })
                    )
                ),
                el(StatsRanking, {
                    popups: popups,
                    summaries: summaries,
                    metric: dash.rankingMetric,
                    selectedPopupId: dash.selectedPopupId,
                    onSelect: function (id) { dash.setSelectedPopupId(id); }
                })
            ),
            !dash.isLoading && !popups.length
                ? el('div', { className: 'lp-panel' },
                    el('div', { className: 'lp-empty' },
                        el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'stats', stroke: true, size: 28 })),
                        el('p', { className: 'lp-empty__title' }, __('Noch keine Popups angelegt', 'legacy-popups')),
                        el('p', { className: 'lp-empty__lede' }, __('Sobald du Popups veroeffentlichst und sie ausgespielt werden, erscheinen hier detaillierte Auswertungen.', 'legacy-popups'))
                    )
                )
                : null
        );
    }

    function SettingsView() {
        return el('div', { className: 'lp-panel' },
            el('div', { className: 'lp-panel__header' },
                el('div', null,
                    el('h3', { className: 'lp-panel__title' }, __('Globale Einstellungen', 'legacy-popups')),
                    el('p', { className: 'lp-panel__hint' }, __('Tracking, Datenschutz, Performance und API-Optionen.', 'legacy-popups'))
                )
            ),
            el('div', { className: 'lp-empty' },
                el('div', { className: 'lp-empty__icon' }, el(Icon, { name: 'settings', stroke: true, size: 28 })),
                el('p', { className: 'lp-empty__title' }, __('Einstellungen folgen in spaeterer Phase', 'legacy-popups')),
                el('p', { className: 'lp-empty__lede' }, __('Hier konfigurierst du global Tracking-Cookies, Aufbewahrungszeiten und API-Limits.', 'legacy-popups'))
            )
        );
    }

    function App() {
        var activeState = useState('dashboard');
        var active = activeState[0];
        var setActive = activeState[1];
        var popupState = usePopupCollection();

        useEffect(function () {
            document.body.classList.add('legacypopups-app-active');

            return function () {
                document.body.classList.remove('legacypopups-app-active');
            };
        }, []);

        function handleCreatePopup() {
            setActive('popups');
            popupState.createPopup();
        }

        function renderView() {
            if (active === 'dashboard') {
                return el(DashboardView, {
                    totalPopups: popupState.totalCount,
                    isCreating: popupState.isCreating,
                    onCreatePopup: handleCreatePopup,
                    onOpenPopups: function () { setActive('popups'); }
                });
            }

            if (active === 'popups') {
                return el(PopupsView, {
                    popupState: popupState,
                    onCreatePopup: handleCreatePopup
                });
            }

            if (active === 'builder') {
                return el(BuilderView, {
                    popups: popupState.items,
                    onCreatePopup: popupState.createPopup,
                    onAfterSave: popupState.refresh
                });
            }

            if (active === 'stats') {
                return el(StatsView, null);
            }

            return el(SettingsView, null);
        }

        return el('div', { className: 'lp-shell' },
            el(Sidebar, {
                active: active,
                onSelect: setActive,
                popupCount: popupState.totalCount
            }),
            el('div', { className: 'lp-main' },
                el(Topbar, {
                    active: active,
                    isCreating: popupState.isCreating,
                    isRefreshing: popupState.isRefreshing,
                    onCreatePopup: handleCreatePopup,
                    onRefreshPopups: popupState.refresh
                }),
                el('main', { className: 'lp-content' + (active === 'builder' ? ' lp-content--builder' : ''), role: 'main' }, renderView())
            )
        );
    }

    function boot() {
        var mount = document.getElementById('legacypopups-app');

        if (!mount) {
            return;
        }

        render(el(App, null), mount);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window.wp);
