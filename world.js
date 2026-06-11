// A small world that occasionally rises over the bottom edge of the page,
// spins for a while, and sets again. Type world() in the console to summon it.
(function () {
    'use strict';

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Equirectangular world map. Rows: 90N -> 90S. '#' = land.
    var WORLD = [
        "........................................................................",
        "........................###########.....................###............",
        "...##########..........#############...........############.............",
        "..############........###############........################...........",
        "..#############.......############.............##############..........",
        "..##############.....##########........####....###############.........",
        "...###########......##########.........#####...##################......",
        "....##########.......#########........######...################.#.....",
        ".....#########........#########.....#########...###############..#....",
        "......########.........########....##########...##############..##....",
        ".......######..........########....##########....#############..###...",
        "........######.........########....#########......############..####..",
        ".........#####.........#######....##########.......#########.....#####",
        "..........####.........#########################....#######......####.",
        "..........#####........##########################....######.....####..",
        "..........######.......########################......####........####.",
        "...........#####........######################........##..........####",
        "............####.........####################.........#............###",
        ".............###...........###############............................",
        "..............##............###########................................",
        "...............#..............#####.....................###############",
        "..##########################################################...........",
        "############################################################............",
        "########################################################################"
    ];
    var WROWS = WORLD.length;
    var WCOLS = WORLD[0].length;

    function isLand(lat, lon) {
        var row = Math.floor(((Math.PI / 2 - lat) / Math.PI) * WROWS);
        var col = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * WCOLS);
        if (row < 0) row = 0;
        if (row >= WROWS) row = WROWS - 1;
        col = ((col % WCOLS) + WCOLS) % WCOLS;
        return WORLD[row][col] === '#';
    }

    var W = 34, H = 17;
    var LAND_CHARS = '·:-=+*%#@';
    var TILT = 0.42;
    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);

    function frame(angle) {
        var lines = [];
        for (var y = 0; y < H; y++) {
            var row = '';
            for (var x = 0; x < W; x++) {
                var nx = (x - W / 2 + 0.5) / (W / 2 - 0.5);
                var ny = (y - H / 2 + 0.5) / (H / 2 - 0.5);
                var r2 = nx * nx + ny * ny;
                if (r2 > 1) { row += ' '; continue; }
                var nz = Math.sqrt(1 - r2);

                // Tilt the pole toward the viewer, then spin around the tilted axis.
                var tyy = ny * cosT + nz * sinT;
                var tzz = -ny * sinT + nz * cosT;
                var rx = nx * Math.cos(angle) - tzz * Math.sin(angle);
                var rz = nx * Math.sin(angle) + tzz * Math.cos(angle);

                var lat = Math.asin(Math.max(-1, Math.min(1, tyy)));
                var lon = Math.atan2(rx, rz);

                if (isLand(lat, lon)) {
                    var diffuse = Math.max(0, -0.45 * nx - 0.45 * ny + 0.77 * nz);
                    var shade = Math.min(1, diffuse * 1.05 + 0.08);
                    var idx = Math.floor(shade * (LAND_CHARS.length - 0.01));
                    row += LAND_CHARS[Math.max(0, Math.min(LAND_CHARS.length - 1, idx))];
                } else {
                    // Open sea stays blank; a faint dotted limb closes the silhouette.
                    row += r2 > 0.86 ? '·' : ' ';
                }
            }
            lines.push(row);
        }
        return lines.join('\n');
    }

    var el = null;
    var visible = false;
    var angle = 2.2;
    var BASE_VEL = 0.35;            // rad/s, ~18s per revolution
    var vel = BASE_VEL;
    var raf = null;
    var last = null;
    var hideTimer = null;
    var RISE_MS = 5500;

    function build() {
        el = document.createElement('pre');
        el.setAttribute('aria-hidden', 'true');
        el.title = 'hello, world';
        var s = el.style;
        s.position = 'fixed';
        s.bottom = '0';
        s.right = (4 + Math.random() * 28) + 'vw';
        s.zIndex = '40';
        s.margin = '0';
        s.fontFamily = "'Menlo', 'Monaco', 'Courier New', monospace";
        s.fontSize = '9px';
        s.lineHeight = '0.95';
        s.letterSpacing = '0';
        s.whiteSpace = 'pre';
        s.color = '#6c757d';
        s.opacity = '0.75';
        s.userSelect = 'none';
        s.webkitUserSelect = 'none';
        s.cursor = 'pointer';
        s.transform = 'translateY(103%)';
        s.transition = reduced ? 'none' : 'transform ' + RISE_MS + 'ms cubic-bezier(0.23, 1, 0.32, 1)';
        el.addEventListener('click', function () { vel += 6; });
        document.body.appendChild(el);
    }

    function tick(now) {
        if (last === null) last = now;
        var dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!reduced) {
            vel += (BASE_VEL - vel) * Math.min(1, dt * 1.5);
            angle += vel * dt;
            el.textContent = frame(angle);
        }
        raf = requestAnimationFrame(tick);
    }

    function show(duration) {
        if (visible) { vel += 6; return; }
        if (!el) build();
        visible = true;
        el.style.right = (4 + Math.random() * 28) + 'vw';
        el.textContent = frame(angle);
        void el.offsetHeight; // commit starting position so the rise transitions
        el.style.transition = reduced ? 'none' : 'transform ' + RISE_MS + 'ms cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.transform = 'translateY(34%)';
        last = null;
        vel = BASE_VEL;
        raf = requestAnimationFrame(tick);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, duration || 26000);
        try { sessionStorage.setItem('world-seen', '1'); } catch (e) { /* ignore */ }
    }

    function hide() {
        if (!visible) return;
        el.style.transition = reduced ? 'none' : 'transform ' + RISE_MS + 'ms cubic-bezier(0.6, 0.04, 0.98, 0.34)';
        el.style.transform = 'translateY(103%)';
        setTimeout(function () {
            visible = false;
            cancelAnimationFrame(raf);
        }, RISE_MS + 200);
    }

    // Once in a while, after a quiet delay, the world rises.
    var seen = false;
    try { seen = !!sessionStorage.getItem('world-seen'); } catch (e) { /* ignore */ }
    var chance = seen ? 0.08 : 0.5;
    if (!reduced && window.innerWidth >= 640 && Math.random() < chance) {
        setTimeout(function () { show(); }, 5000 + Math.random() * 18000);
    }

    window.world = function () {
        show(40000);
        return '(watch the bottom of the page)';
    };

    try {
        console.log('%cpsst — type world() sometime', 'color:#6c757d;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
