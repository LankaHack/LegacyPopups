(function () {
    'use strict';

    var config = window.LegacyPopupsFrontend || {};
    var allPopups = Array.isArray(config.popups) ? config.popups.slice() : [];
    var queue = [];
    var currentMount = null;
    var activePayload = null;
    var root = null;
    var scheduledIds = {};
    var shownIds = {};
    var triggerEngine = null;
    var frequencyGate = null;
    var trackingClient = null;

    function boot() {
        if (!allPopups.length || !document.body) {
            return;
        }

        root = document.createElement('div');
        root.className = 'lp-runtime-root';
        document.body.appendChild(root);
        frequencyGate = createFrequencyGate();
        trackingClient = createTrackingClient();
        triggerEngine = createTriggerEngine({
            schedule: schedulePopup
        });
        triggerEngine.register(allPopups);
        document.addEventListener('keydown', onKeydown);
    }

    function onKeydown(event) {
        if (event.key === 'Escape' && currentMount) {
            closeCurrent();
        }
    }

    function renderNext() {
        if (currentMount || !queue.length) {
            return;
        }

        activePayload = queue.shift();
        currentMount = buildPopup(activePayload);
        root.appendChild(currentMount);

        window.requestAnimationFrame(function () {
            currentMount.classList.add('is-visible');
            if (frequencyGate) {
                frequencyGate.record(activePayload, 'impression');
            }
            if (trackingClient) {
                trackingClient.track(activePayload, 'impression');
            }
        });
    }

    function schedulePopup(payload) {
        var popupId = String(payload && payload.id ? payload.id : '');

        if (!popupId || scheduledIds[popupId] || shownIds[popupId]) {
            return;
        }

        if (frequencyGate && !frequencyGate.canDisplay(payload)) {
            return;
        }

        scheduledIds[popupId] = true;
        queue.push(payload);
        renderNext();
    }

    function closeCurrent() {
        if (!currentMount) {
            return;
        }

        var mount = currentMount;
        var closedPopupId = String(activePayload && activePayload.id ? activePayload.id : '');
        currentMount = null;
        activePayload = null;
        mount.classList.remove('is-visible');
        mount.classList.add('is-closing');

        if (closedPopupId) {
            shownIds[closedPopupId] = true;
            if (frequencyGate) {
                frequencyGate.record(mount.__lpPayload || { id: closedPopupId }, 'close');
            }
            if (trackingClient) {
                trackingClient.track(mount.__lpPayload || { id: closedPopupId }, 'close');
            }
        }

        window.setTimeout(function () {
            if (mount.parentNode) {
                mount.parentNode.removeChild(mount);
            }

            renderNext();
        }, 180);
    }

    function buildPopup(payload) {
        var layout = payload.layout || {};
        var mount = document.createElement('div');
        var overlay = document.createElement('div');
        var stage = document.createElement('div');
        var panel = document.createElement('section');
        var closeButton = document.createElement('button');
        var nodes = Array.isArray(payload.nodes) ? payload.nodes : [];

        mount.className = 'lp-runtime lp-runtime--' + normalizePosition(layout.position);
        mount.setAttribute('data-popup-id', String(payload.id || ''));
        mount.setAttribute('data-animation', normalizeAnimation(layout.animation));
        mount.__lpPayload = payload;

        overlay.className = 'lp-runtime__overlay';
        overlay.style.background = layout.overlay
            ? hexToRgba(layout.overlayColor || '#000000', Number(layout.overlayOpacity || 50) / 100)
            : 'transparent';
        overlay.addEventListener('click', closeCurrent);

        stage.className = 'lp-runtime__stage';

        panel.className = 'lp-runtime__panel';
        panel.setAttribute('aria-label', payload.title || 'LegacyPopups');
        panel.style.width = Math.max(240, Number(layout.width || 540)) + 'px';
        panel.style.background = layout.background || '#ffffff';
        panel.style.borderRadius = Math.max(0, Number(layout.borderRadius || 18)) + 'px';
        panel.style.padding = Math.max(0, Number(layout.padding || 36)) + 'px';
        panel.style.boxShadow = resolveShadow(layout.shadow);

        if (!layout.overlay) {
            mount.classList.add('has-no-overlay');
        }

        closeButton.type = 'button';
        closeButton.className = 'lp-runtime__close';
        closeButton.setAttribute('aria-label', config.i18n && config.i18n.closeLabel ? config.i18n.closeLabel : 'Close');
        closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
        closeButton.addEventListener('click', closeCurrent);

        panel.appendChild(closeButton);

        nodes.forEach(function (node) {
            var element = renderNode(node, payload);
            if (element) {
                panel.appendChild(element);
            }
        });

        stage.appendChild(panel);
        mount.appendChild(overlay);
        mount.appendChild(stage);

        return mount;
    }

    function createTriggerEngine(context) {
        var handlerFactories = {
            page_load: createPageLoadTriggerHandler,
            time_delay: createTimeDelayTriggerHandler,
            scroll_percent: createScrollPercentTriggerHandler,
            selector_hit: createSelectorHitTriggerHandler,
            exit_intent: createExitIntentTriggerHandler
        };

        return {
            register: function (popups) {
                var triggerEntriesByType = collectTriggerEntriesByType(popups);

                Object.keys(triggerEntriesByType).forEach(function (type) {
                    var entries = triggerEntriesByType[type];
                    var factory = handlerFactories[type];

                    if (factory && entries.length) {
                        factory(context, entries).init();
                    }
                });
            }
        };
    }

    function collectTriggerEntriesByType(popups) {
        var triggerEntriesByType = {};

        popups.forEach(function (popup) {
            var triggers = Array.isArray(popup.triggers) && popup.triggers.length
                ? popup.triggers
                : [{ type: 'page_load' }];

            triggers.forEach(function (trigger) {
                if (!trigger || !trigger.type) {
                    return;
                }

                if (!triggerEntriesByType[trigger.type]) {
                    triggerEntriesByType[trigger.type] = [];
                }

                triggerEntriesByType[trigger.type].push({
                    popup: popup,
                    trigger: trigger
                });
            });
        });

        return triggerEntriesByType;
    }

    function createPageLoadTriggerHandler(context, entries) {
        return {
            init: function () {
                runAfterDomReady(function () {
                    entries.forEach(function (entry) {
                        context.schedule(entry.popup);
                    });
                });
            }
        };
    }

    function createTimeDelayTriggerHandler(context, entries) {
        return {
            init: function () {
                runAfterDomReady(function () {
                    entries.forEach(function (entry) {
                        var delayMs = Math.max(0, Number(entry.trigger && entry.trigger.seconds ? entry.trigger.seconds : 0)) * 1000;

                        window.setTimeout(function () {
                            context.schedule(entry.popup);
                        }, delayMs);
                    });
                });
            }
        };
    }

    function createScrollPercentTriggerHandler(context, entries) {
        var pending = entries.slice();
        var ticking = false;

        function detach() {
            window.removeEventListener('scroll', requestCheck);
            window.removeEventListener('resize', requestCheck);
        }

        function flush() {
            var scrollPercent = getScrollPercent();

            ticking = false;
            pending = pending.filter(function (entry) {
                if (scrollPercent >= Math.max(0, Number(entry.trigger.percent || 0))) {
                    context.schedule(entry.popup);
                    return false;
                }

                return true;
            });

            if (!pending.length) {
                detach();
            }
        }

        function requestCheck() {
            if (ticking) {
                return;
            }

            ticking = true;
            window.requestAnimationFrame(flush);
        }

        return {
            init: function () {
                runAfterDomReady(function () {
                    requestCheck();
                    window.addEventListener('scroll', requestCheck, { passive: true });
                    window.addEventListener('resize', requestCheck);
                });
            }
        };
    }

    function createSelectorHitTriggerHandler(context, entries) {
        function buildWatchEntries() {
            return entries.map(function (entry) {
                return {
                    popup: entry.popup,
                    selector: entry.trigger.selector,
                    elements: safeQuerySelectorAll(entry.trigger.selector),
                    done: false
                };
            }).filter(function (entry) {
                return entry.selector && entry.elements.length;
            });
        }

        return {
            init: function () {
                runAfterDomReady(function () {
                    var watches = buildWatchEntries();

                    if (!watches.length) {
                        return;
                    }

                    if ('IntersectionObserver' in window) {
                        initSelectorObserver(context, watches);
                        return;
                    }

                    initSelectorFallback(context, watches);
                });
            }
        };
    }

    function createExitIntentTriggerHandler(context, entries) {
        function handleMouseOut(event) {
            if (event.relatedTarget || event.toElement) {
                return;
            }

            if (typeof event.clientY === 'number' && event.clientY > 24) {
                return;
            }

            document.removeEventListener('mouseout', handleMouseOut);
            entries.forEach(function (entry) {
                context.schedule(entry.popup);
            });
        }

        return {
            init: function () {
                runAfterDomReady(function () {
                    if (window.matchMedia && !window.matchMedia('(pointer:fine)').matches) {
                        return;
                    }

                    document.addEventListener('mouseout', handleMouseOut);
                });
            }
        };
    }

    function initSelectorObserver(context, watches) {
        var observer = new IntersectionObserver(function (observerEntries) {
            observerEntries.forEach(function (observerEntry) {
                var watch = observerEntry.target.__lpWatch;

                if (!watch || watch.done || !observerEntry.isIntersecting) {
                    return;
                }

                watch.done = true;
                context.schedule(watch.popup);
                watch.elements.forEach(function (element) {
                    observer.unobserve(element);
                    delete element.__lpWatch;
                });
            });
        }, {
            threshold: 0.15
        });

        watches.forEach(function (watch) {
            watch.elements.forEach(function (element) {
                element.__lpWatch = watch;
                observer.observe(element);
            });
        });
    }

    function initSelectorFallback(context, watches) {
        var pending = watches.slice();
        var ticking = false;

        function detach() {
            window.removeEventListener('scroll', requestCheck);
            window.removeEventListener('resize', requestCheck);
        }

        function flush() {
            ticking = false;
            pending = pending.filter(function (watch) {
                if (watch.done) {
                    return false;
                }

                if (watch.elements.some(isElementInViewport)) {
                    watch.done = true;
                    context.schedule(watch.popup);
                    return false;
                }

                return true;
            });

            if (!pending.length) {
                detach();
            }
        }

        function requestCheck() {
            if (ticking) {
                return;
            }

            ticking = true;
            window.requestAnimationFrame(flush);
        }

        requestCheck();
        window.addEventListener('scroll', requestCheck, { passive: true });
        window.addEventListener('resize', requestCheck);
    }

    function runAfterDomReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
            return;
        }

        callback();
    }

    function renderNode(node, payload) {
        if (!node || !node.type || !node.props) {
            return null;
        }

        if (node.type === 'text') {
            return renderText(node.props);
        }

        if (node.type === 'image') {
            return renderImage(node.props);
        }

        if (node.type === 'button') {
            return renderButton(node.props, payload);
        }

        if (node.type === 'spacer') {
            return renderSpacer(node.props);
        }

        return null;
    }

    function renderText(props) {
        var element = document.createElement('div');

        element.className = 'lp-runtime__node lp-runtime__node--text';
        element.textContent = props.content || '';
        element.style.fontSize = Number(props.fontSize || 16) + 'px';
        element.style.fontWeight = String(props.fontWeight || 400);
        element.style.color = props.color || '#1a1a1d';
        element.style.textAlign = props.align || 'left';
        element.style.lineHeight = String(props.lineHeight || 1.5);
        element.style.letterSpacing = Number(props.letterSpacing || 0) + 'px';
        element.style.textDecoration = props.textDecoration || 'none';

        return element;
    }

    function renderImage(props) {
        if (!props.src) {
            return null;
        }

        var wrap = document.createElement('div');
        var image = document.createElement('img');

        wrap.className = 'lp-runtime__node lp-runtime__node--image';
        image.src = props.src;
        image.alt = props.alt || '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'strict-origin-when-cross-origin';
        image.style.width = props.width || '100%';
        image.style.borderRadius = Math.max(0, Number(props.borderRadius || 4)) + 'px';
        image.style.objectFit = props.objectFit || 'cover';
        image.style.boxShadow = props.shadow ? '0 4px 18px rgba(0, 0, 0, 0.18)' : 'none';

        wrap.appendChild(image);

        return wrap;
    }

    function renderButton(props, payload) {
        var wrap = document.createElement('div');
        var link = document.createElement('a');
        var variant = props.variant || 'solid';
        var isFull = props.width === 'full';

        wrap.className = 'lp-runtime__node lp-runtime__node--button' + (isFull ? ' is-full' : '');
        link.className = 'lp-runtime__button';
        link.href = props.url || '#';
        link.textContent = props.label || '';
        link.style.fontSize = Number(props.fontSize || 14) + 'px';
        link.style.fontWeight = String(props.fontWeight || 600);
        link.style.padding = Math.max(2, Number(props.paddingY || 10)) + 'px ' + Math.max(4, Number(props.paddingX || 24)) + 'px';
        link.style.borderRadius = Math.max(0, Number(props.borderRadius || 8)) + 'px';
        link.style.boxShadow = props.shadow ? '0 4px 14px rgba(0, 0, 0, 0.20)' : 'none';

        if (isFull) {
            link.style.display = 'block';
            link.style.width = '100%';
        }

        if (variant === 'outline') {
            link.style.border = '2px solid ' + (props.background || '#0f6a5a');
            link.style.color = props.background || '#0f6a5a';
            link.style.background = 'transparent';
        } else if (variant === 'ghost') {
            link.style.color = props.background || '#0f6a5a';
            link.style.background = 'transparent';
        } else {
            link.style.background = props.background || '#0f6a5a';
            link.style.color = props.color || '#ffffff';
        }

        link.addEventListener('click', function () {
            if (trackingClient) {
                trackingClient.track(payload, 'click');
            }

            if (shouldTrackConversion(props)) {
                if (frequencyGate) {
                    frequencyGate.record(payload, 'conversion');
                }

                if (trackingClient) {
                    trackingClient.track(payload, 'conversion');
                }
            }
        });

        wrap.appendChild(link);

        return wrap;
    }

    function shouldTrackConversion(props) {
        return !!(props && (
            props.trackConversion === true ||
            props.tracksConversion === true ||
            props.isConversion === true ||
            props.trackConversion === 1 ||
            props.trackConversion === '1' ||
            props.trackConversion === 'true' ||
            props.tracksConversion === 1 ||
            props.tracksConversion === '1' ||
            props.tracksConversion === 'true' ||
            props.isConversion === 1 ||
            props.isConversion === '1' ||
            props.isConversion === 'true'
        ));
    }

    function createTrackingClient() {
        var settings = config.tracking || {};
        var sessionStorageRef = getStorageRef('sessionStorage');
        var localStorageRef = getStorageRef('localStorage');

        if (!settings.enabled || !settings.endpoint || !settings.nonce) {
            return null;
        }

        if (settings.respectDoNotTrack && isDoNotTrackEnabled()) {
            return null;
        }

        var sessionToken = getOrCreateTrackingToken(
            settings.sessionKey || 'legacypopups:tracking:session',
            sessionStorageRef,
            settings.cookieFallback !== false,
            0
        );
        var visitorToken = getOrCreateTrackingToken(
            settings.visitorKey || 'legacypopups:tracking:visitor',
            localStorageRef,
            settings.cookieFallback !== false,
            30
        );

        return {
            track: function (payload, eventType) {
                if (!payload || !payload.id || !eventType) {
                    return;
                }

                sendTrackingEvent({
                    popup_id: Number(payload.id),
                    event_type: String(eventType),
                    session_token: sessionToken,
                    visitor_token: visitorToken,
                    url: window.location.pathname || '/',
                    _lpnonce: settings.nonce
                });
            }
        };

        function sendTrackingEvent(body) {
            var serialized = JSON.stringify(body);

            if (navigator.sendBeacon) {
                try {
                    if (navigator.sendBeacon(settings.endpoint, new Blob([serialized], { type: 'application/json; charset=UTF-8' }))) {
                        return;
                    }
                } catch (error) {
                }
            }

            if (!window.fetch) {
                return;
            }

            window.fetch(settings.endpoint, {
                method: 'POST',
                credentials: 'same-origin',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    'X-LegacyPopups-Nonce': settings.nonce
                },
                body: serialized
            }).catch(function () {
            });
        }
    }

    function getOrCreateTrackingToken(key, storageRef, cookieFallback, cookieDays) {
        var value = '';

        if (storageRef) {
            value = storageRef.getItem(key);
        } else if (cookieFallback) {
            value = readCookie(key);
        }

        if (value) {
            return value;
        }

        value = generateTrackingToken();

        if (storageRef) {
            storageRef.setItem(key, value);
        } else if (cookieFallback) {
            writeCookie(key, value, cookieDays);
        }

        return value;
    }

    function generateTrackingToken() {
        if (window.crypto && window.crypto.getRandomValues) {
            var buffer = new Uint8Array(18);

            window.crypto.getRandomValues(buffer);

            return Array.prototype.map.call(buffer, function (part) {
                return ('0' + part.toString(16)).slice(-2);
            }).join('');
        }

        return String(Date.now()) + String(Math.random()).replace(/\D/g, '');
    }

    function isDoNotTrackEnabled() {
        var value = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || '';

        return value === '1' || value === 'yes';
    }

    function createFrequencyGate() {
        var storage = createFrequencyStorage();

        return {
            canDisplay: function (payload) {
                var events = getFrequencyEvents(payload);

                return Object.keys(events).every(function (eventType) {
                    return isAllowed(payload, eventType, events[eventType]);
                });
            },
            record: function (payload, eventType) {
                var events = getFrequencyEvents(payload);
                var rule = events[eventType];

                if (!rule) {
                    return;
                }

                recordEvent(payload, eventType, rule);
            }
        };

        function isAllowed(payload, eventType, rule) {
            var popupId = getPopupId(payload);
            var storageOptions = getFrequencyStorageOptions(payload);

            if (!popupId) {
                return true;
            }

            if (rule.sessionOnce && storage.getSessionFlag(sessionKey(popupId, eventType), storageOptions)) {
                return false;
            }

            if (!rule.periodDays && !rule.maxCount) {
                return true;
            }

            var state = storage.getPersistentState(persistentKey(popupId, eventType), rule.periodDays, storageOptions);
            var limit = getLimit(rule);

            if (!limit) {
                return true;
            }

            return state.count < limit;
        }

        function recordEvent(payload, eventType, rule) {
            var popupId = getPopupId(payload);
            var storageOptions = getFrequencyStorageOptions(payload);

            if (!popupId) {
                return;
            }

            if (rule.sessionOnce) {
                storage.setSessionFlag(sessionKey(popupId, eventType), storageOptions);
            }

            if (!rule.periodDays && !rule.maxCount) {
                return;
            }

            var key = persistentKey(popupId, eventType);
            var state = storage.getPersistentState(key, rule.periodDays, storageOptions);

            state.count += 1;
            state.updatedAt = Date.now();

            if (!state.startedAt) {
                state.startedAt = state.updatedAt;
            }

            storage.setPersistentState(key, state, rule.periodDays, storageOptions);
        }

        function getFrequencyEvents(payload) {
            return payload && payload.frequency && payload.frequency.events
                ? payload.frequency.events
                : {};
        }

        function getFrequencyStorageOptions(payload) {
            var storageOptions = payload && payload.frequency && payload.frequency.storage
                ? payload.frequency.storage
                : {};

            return {
                session: storageOptions.session !== false,
                local: storageOptions.local !== false,
                cookieFallback: storageOptions.cookieFallback !== false
            };
        }

        function getLimit(rule) {
            if (rule.maxCount && Number(rule.maxCount) > 0) {
                return Number(rule.maxCount);
            }

            if (rule.oncePerPeriod && Number(rule.periodDays) > 0) {
                return 1;
            }

            return 0;
        }

        function getPopupId(payload) {
            return String(payload && payload.id ? payload.id : '');
        }

        function sessionKey(popupId, eventType) {
            return 'legacypopups:session:' + popupId + ':' + eventType;
        }

        function persistentKey(popupId, eventType) {
            return 'legacypopups:persistent:' + popupId + ':' + eventType;
        }
    }

    function createFrequencyStorage() {
        var sessionStorageRef = getStorageRef('sessionStorage');
        var localStorageRef = getStorageRef('localStorage');

        return {
            getSessionFlag: function (key, options) {
                var value = '';

                if (options.session && sessionStorageRef) {
                    value = sessionStorageRef.getItem(key);
                } else if (options.cookieFallback) {
                    value = readCookie(key);
                }

                return value === '1';
            },
            setSessionFlag: function (key, options) {
                if (options.session && sessionStorageRef) {
                    sessionStorageRef.setItem(key, '1');
                    return;
                }

                if (options.cookieFallback) {
                    writeCookie(key, '1');
                }
            },
            getPersistentState: function (key, periodDays, options) {
                var raw = '';

                if (options.local && localStorageRef) {
                    raw = localStorageRef.getItem(key);
                } else if (options.cookieFallback) {
                    raw = readCookie(key);
                }

                var state = parsePersistentState(raw);

                if (periodDays > 0 && isExpired(state, periodDays)) {
                    return emptyPersistentState();
                }

                return state;
            },
            setPersistentState: function (key, state, periodDays, options) {
                var serialized = JSON.stringify(state);

                if (options.local && localStorageRef) {
                    localStorageRef.setItem(key, serialized);
                    return;
                }

                if (options.cookieFallback) {
                    writeCookie(key, serialized, periodDays);
                }
            }
        };
    }

    function getStorageRef(name) {
        try {
            var ref = window[name];
            var probe = '__lp_probe__';

            if (!ref) {
                return null;
            }

            ref.setItem(probe, '1');
            ref.removeItem(probe);

            return ref;
        } catch (error) {
            return null;
        }
    }

    function emptyPersistentState() {
        return {
            count: 0,
            startedAt: 0,
            updatedAt: 0
        };
    }

    function parsePersistentState(raw) {
        if (!raw) {
            return emptyPersistentState();
        }

        try {
            var parsed = JSON.parse(raw);

            return {
                count: Math.max(0, Number(parsed.count || 0)),
                startedAt: Math.max(0, Number(parsed.startedAt || 0)),
                updatedAt: Math.max(0, Number(parsed.updatedAt || 0))
            };
        } catch (error) {
            return emptyPersistentState();
        }
    }

    function isExpired(state, periodDays) {
        var periodMs = Number(periodDays) * 24 * 60 * 60 * 1000;

        if (!periodMs || !state.startedAt) {
            return false;
        }

        return (Date.now() - state.startedAt) >= periodMs;
    }

    function readCookie(name) {
        var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));

        return match ? decodeURIComponent(match[1]) : '';
    }

    function writeCookie(name, value, periodDays) {
        var cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; path=/; SameSite=Lax';

        if (Number(periodDays) > 0) {
            cookie += '; max-age=' + Math.round(Number(periodDays) * 24 * 60 * 60);
        }

        document.cookie = cookie;
    }

    function renderSpacer(props) {
        var spacer = document.createElement('div');

        spacer.className = 'lp-runtime__node lp-runtime__node--spacer';
        spacer.style.height = Math.max(4, Number(props.height || 24)) + 'px';

        return spacer;
    }

    function normalizePosition(position) {
        var allowed = {
            'center': true,
            'top-left': true,
            'top-center': true,
            'top-right': true,
            'bottom-left': true,
            'bottom-center': true,
            'bottom-right': true
        };

        return allowed[position] ? position : 'center';
    }

    function normalizeAnimation(animation) {
        var allowed = {
            'none': true,
            'fade': true,
            'slide-up': true,
            'slide-down': true,
            'zoom': true
        };

        return allowed[animation] ? animation : 'fade';
    }

    function resolveShadow(shadow) {
        var map = {
            'none': 'none',
            'sm': '0 2px 8px rgba(0, 0, 0, 0.10)',
            'md': '0 8px 32px rgba(0, 0, 0, 0.15)',
            'lg': '0 16px 56px rgba(0, 0, 0, 0.22)',
            'xl': '0 24px 80px rgba(0, 0, 0, 0.28)'
        };

        return map[shadow] || map.md;
    }

    function getScrollPercent() {
        var doc = document.documentElement;
        var body = document.body;
        var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
        var viewportHeight = window.innerHeight || doc.clientHeight || 0;
        var scrollHeight = Math.max(
            body.scrollHeight,
            doc.scrollHeight,
            body.offsetHeight,
            doc.offsetHeight,
            body.clientHeight,
            doc.clientHeight
        );
        var travelDistance = Math.max(0, scrollHeight - viewportHeight);

        if (!travelDistance) {
            return 100;
        }

        return (scrollTop / travelDistance) * 100;
    }

    function safeQuerySelectorAll(selector) {
        try {
            return Array.prototype.slice.call(document.querySelectorAll(selector));
        } catch (error) {
            return [];
        }
    }

    function isElementInViewport(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return false;
        }

        var rect = element.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

        return rect.top <= viewportHeight && rect.bottom >= 0;
    }

    function hexToRgba(hex, alpha) {
        var match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');

        if (!match) {
            return 'rgba(0, 0, 0, ' + alpha + ')';
        }

        return 'rgba(' + parseInt(match[1], 16) + ', ' + parseInt(match[2], 16) + ', ' + parseInt(match[3], 16) + ', ' + alpha + ')';
    }

    function exposeTestApi() {
        if (typeof window === 'undefined' || !window.__LEGACY_POPUPS_TEST__) {
            return;
        }

        window.LegacyPopupsRuntimeTest = {
            collectTriggerEntriesByType: collectTriggerEntriesByType,
            createFrequencyGate: createFrequencyGate,
            createFrequencyStorage: createFrequencyStorage,
            createTriggerEngine: createTriggerEngine
        };
    }

    exposeTestApi();
    runAfterDomReady(boot);
}());