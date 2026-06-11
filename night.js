// Stay on a page long enough and night falls: the moon comes out (showing its
// real phase for today), stars appear in the margins, and once in a while one
// of them falls. Hover the sky to find the constellations.
// Console: night() to skip the wait, day() to clear the sky.
(function () {
    'use strict';

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var PAD = 26;               // breathing room between content column and sky
    var STAR_RGB = '96, 108, 122';

    // ---- the actual moon ----
    var PHASE_NAMES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous',
                       'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
    // Sun/moon ecliptic longitudes with the main perturbation terms (truncated
    // Meeus). Elongation comes out within ~0.5°, so the lit percentage matches
    // the almanac to about a point. 0 = new, 0.5 = full.
    function moonPhase() {
        var d = Date.now() / 86400000 - 10957.5;     // days since J2000.0
        var rad = Math.PI / 180;
        var Ms = 357.529 + 0.98560028 * d;           // sun mean anomaly
        var sunLon = 280.459 + 0.98564736 * d
            + 1.915 * Math.sin(Ms * rad)
            + 0.020 * Math.sin(2 * Ms * rad);
        var Lm = 218.316 + 13.176396 * d;            // moon mean longitude
        var Mm = 134.963 + 13.064993 * d;            // moon mean anomaly
        var Dm = 297.850 + 12.190749 * d;            // mean elongation
        var moonLon = Lm
            + 6.289 * Math.sin(Mm * rad)             // equation of the centre
            + 1.274 * Math.sin((2 * Dm - Mm) * rad)  // evection
            + 0.658 * Math.sin(2 * Dm * rad)         // variation
            - 0.186 * Math.sin(Ms * rad);            // annual equation
        var elong = (((moonLon - sunLon) % 360) + 360) % 360;
        return elong / 360;
    }
    function phaseName(p) { return PHASE_NAMES[Math.round(p * 8) % 8]; }
    function phaseIllum(p) { return (1 - Math.cos(2 * Math.PI * p)) / 2; }

    // Traces the lit part of the moon for phase p (0 = new, 0.5 = full).
    function moonLitPath(c, x, y, r, p) {
        var k = Math.cos(2 * Math.PI * p);
        var waxing = p < 0.5;
        c.beginPath();
        if (waxing) {
            c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
            c.ellipse(x, y, Math.abs(r * k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
        } else {
            c.arc(x, y, r, Math.PI / 2, -Math.PI / 2, false);
            c.ellipse(x, y, Math.abs(r * k), r, 0, -Math.PI / 2, Math.PI / 2, k > 0);
        }
        c.closePath();
    }

    // ---- constellations (normalized boxes, y down; array order = priority) ----
    var CONSTELLATIONS = [
        {
            name: 'ursa major', zone: 'right', aspect: 0.50, maxW: 215, vpos: 0.58,
            pts: [[0.04, 0.50], [0.24, 0.32], [0.42, 0.26], [0.58, 0.22], [0.78, 0.12], [0.82, 0.42], [0.62, 0.48]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
        },
        {
            name: 'orion', zone: 'left', aspect: 1.40, maxW: 145, vpos: 0.76,
            pts: [[0.26, 0.12], [0.72, 0.16], [0.40, 0.54], [0.50, 0.50], [0.60, 0.46], [0.34, 0.88], [0.74, 0.86]],
            lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]]
        },
        {
            name: 'cassiopeia', zone: 'left', aspect: 0.45, maxW: 165, vpos: 0.20,
            pts: [[0.04, 0.52], [0.27, 0.20], [0.50, 0.48], [0.73, 0.16], [0.96, 0.40]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
        },
        {
            // the little dipper, pouring back toward the big one; Polaris at the handle tip
            name: 'ursa minor', zone: 'right', aspect: 0.62, maxW: 150, vpos: 0.36,
            pts: [[0.96, 0.08], [0.80, 0.20], [0.62, 0.33], [0.45, 0.44], [0.26, 0.58], [0.06, 0.46], [0.24, 0.31]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
        },
        {
            // the northern cross: Deneb at the top, Albireo at the foot
            name: 'cygnus', zone: 'left', aspect: 1.20, maxW: 130, vpos: 0.42,
            pts: [[0.50, 0.04], [0.50, 0.40], [0.54, 0.96], [0.12, 0.22], [0.88, 0.56]],
            lines: [[0, 1], [1, 2], [3, 1], [1, 4]]
        }
    ];

    var canvas = null, ctx = null;
    var active = false, raf = null;
    var duskStart = 0, duskLen = 70000;
    var fadingOut = false, fadeOutStart = 0;
    var stars = [], consts = [], moon = null, shoots = [];
    var mouse = { x: -1e4, y: -1e4 };
    var shootTimer = null, resizeTimer = null, autoTimer = null, dayTimer = null;

    function sizeCanvas() {
        var dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        var s = canvas.style;
        s.position = 'fixed';
        s.inset = '0';
        s.width = '100%';
        s.height = '100%';
        s.pointerEvents = 'none';
        s.zIndex = '999';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        sizeCanvas();
    }

    // The sky lives in the side margins, outside the content column.
    function buildSky() {
        stars = [];
        consts = [];
        moon = null;
        shoots = [];

        var vw = window.innerWidth, vh = window.innerHeight;
        var main = document.querySelector('main');
        var rect = main ? main.getBoundingClientRect() : { left: vw / 2, right: vw / 2 };
        var zones = {
            left: { x: 10, y: 12, w: rect.left - PAD - 10, h: vh - 24 },
            right: { x: rect.right + PAD, y: 12, w: vw - rect.right - PAD - 10, h: vh - 24 }
        };

        ['left', 'right'].forEach(function (side) {
            var z = zones[side];
            if (z.w < 80) return;
            var n = Math.min(60, Math.round((z.w * z.h) / 8500));
            for (var i = 0; i < n; i++) {
                stars.push({
                    x: z.x + Math.random() * z.w,
                    y: z.y + Math.random() * z.h,
                    r: 0.5 + Math.random() * 1.1,
                    base: 0.15 + Math.random() * 0.33,
                    period: 2500 + Math.random() * 4500,
                    ph: Math.random() * 6.28,
                    appear: Math.random() * 0.85
                });
            }
        });

        var placed = { left: [], right: [] };

        // the moon claims the top-right corner first
        if (zones.right.w >= 90) {
            moon = {
                x: zones.right.x + Math.min(zones.right.w * 0.5, 130),
                y: 105,
                r: 14,
                phase: moonPhase(),
                hover: 0
            };
            placed.right.push({ y0: 40, y1: 172 }); // glow + phase label space
        }

        CONSTELLATIONS.forEach(function (def) {
            var z = zones[def.zone];
            if (!z || z.w < 120) return;
            var w = Math.min(def.maxW, z.w - 24);
            var h = w * def.aspect;
            if (h > z.h - 60) return;
            var x0 = z.x + (z.w - w) / 2;
            var y0 = Math.min(Math.max(z.y + 10, vh * def.vpos - h / 2), vh - h - 50);
            var rects = placed[def.zone];
            for (var k = 0; k < rects.length; k++) {
                if (y0 - 26 < rects[k].y1 && y0 + h + 26 > rects[k].y0) return; // crowded: skip
            }
            rects.push({ y0: y0, y1: y0 + h + 18 }); // body + name label
            var c = {
                name: def.name, lines: def.lines, hover: 0,
                cx: x0 + w / 2, cy: y0 + h / 2,
                hoverR: Math.max(w, h) / 2 + 36,
                labelY: y0 + h + 18,
                stars: def.pts.map(function (pt) {
                    var st = {
                        x: x0 + pt[0] * w,
                        y: y0 + pt[1] * h,
                        r: 1.5 + Math.random() * 0.6,
                        base: 0.48 + Math.random() * 0.12,
                        period: 3500 + Math.random() * 4000,
                        ph: Math.random() * 6.28,
                        appear: Math.random() * 0.4
                    };
                    stars.push(st);
                    return st;
                })
            };
            consts.push(c);
        });

        return stars.length > 0 || !!moon;
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function draw(t) {
        var vw = window.innerWidth, vh = window.innerHeight;
        ctx.clearRect(0, 0, vw, vh);

        var dusk = reduced ? 1 : clamp01((t - duskStart) / Math.max(1, duskLen));
        var fade = 1;
        if (fadingOut) {
            fade = 1 - clamp01((t - fadeOutStart) / 1200);
            if (fade <= 0) { deactivate(); return; }
        }

        // stars
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var ap = clamp01((dusk - s.appear) / 0.12);
            if (ap <= 0) continue;
            var tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 2 * Math.PI / s.period + s.ph);
            var a = s.base * ap * tw * fade;
            ctx.fillStyle = 'rgba(' + STAR_RGB + ',' + a + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, 6.2832);
            ctx.fill();
            if (s.r > 1.7) {
                ctx.strokeStyle = 'rgba(' + STAR_RGB + ',' + (a * 0.35) + ')';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(s.x - s.r * 2.6, s.y); ctx.lineTo(s.x + s.r * 2.6, s.y);
                ctx.moveTo(s.x, s.y - s.r * 2.6); ctx.lineTo(s.x, s.y + s.r * 2.6);
                ctx.stroke();
            }
        }

        // constellation lines + names, on hover
        ctx.font = "10px 'Menlo', 'Monaco', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (var j = 0; j < consts.length; j++) {
            var c = consts[j];
            var dx = mouse.x - c.cx, dy = mouse.y - c.cy;
            var target = (Math.sqrt(dx * dx + dy * dy) < c.hoverR && dusk > 0.5) ? 1 : 0;
            c.hover += (target - c.hover) * (reduced ? 1 : 0.08);
            if (c.hover < 0.01) continue;
            ctx.strokeStyle = 'rgba(' + STAR_RGB + ',' + (c.hover * 0.22 * fade) + ')';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (var k = 0; k < c.lines.length; k++) {
                var a1 = c.stars[c.lines[k][0]], a2 = c.stars[c.lines[k][1]];
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
            }
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + STAR_RGB + ',' + (c.hover * 0.65 * fade) + ')';
            ctx.fillText(c.name, c.cx, c.labelY);
        }

        // the moon
        if (moon) {
            var map = clamp01((dusk - 0.04) / 0.5);
            if (map > 0) {
                var rise = reduced ? 0 : (1 - (1 - Math.pow(1 - map, 2))) * 22;
                var my = moon.y + rise;
                var glow = ctx.createRadialGradient(moon.x, my, moon.r * 0.3, moon.x, my, moon.r * 3);
                glow.addColorStop(0, 'rgba(' + STAR_RGB + ',' + (0.10 * map * fade) + ')');
                glow.addColorStop(1, 'rgba(' + STAR_RGB + ',0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(moon.x, my, moon.r * 3, 0, 6.2832);
                ctx.fill();
                ctx.strokeStyle = 'rgba(' + STAR_RGB + ',' + (0.16 * map * fade) + ')';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(moon.x, my, moon.r, 0, 6.2832);
                ctx.stroke();
                moonLitPath(ctx, moon.x, my, moon.r, moon.phase);
                ctx.fillStyle = 'rgba(' + STAR_RGB + ',' + (0.5 * map * fade) + ')';
                ctx.fill();

                var mdx = mouse.x - moon.x, mdy = mouse.y - my;
                var mTarget = Math.sqrt(mdx * mdx + mdy * mdy) < moon.r + 26 ? 1 : 0;
                moon.hover += (mTarget - moon.hover) * (reduced ? 1 : 0.08);
                if (moon.hover > 0.01) {
                    ctx.fillStyle = 'rgba(' + STAR_RGB + ',' + (moon.hover * 0.7 * fade) + ')';
                    ctx.fillText(phaseName(moon.phase) + ' · ' + Math.round(phaseIllum(moon.phase) * 100) + '% lit',
                                 moon.x, my + moon.r + 20);
                }
            }
        }

        // falling stars
        for (var q = shoots.length - 1; q >= 0; q--) {
            var sh = shoots[q];
            var p = (t - sh.t0) / sh.life;
            if (p >= 1) { shoots.splice(q, 1); continue; }
            var e = 1 - (1 - p) * (1 - p);
            var hx = sh.x0 + sh.dx * e, hy = sh.y0 + sh.dy * e;
            var tx = hx - sh.dx * 0.26, ty = hy - sh.dy * 0.26;
            var sa = Math.sin(Math.PI * p) * 0.4 * fade;
            var grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, 'rgba(' + STAR_RGB + ',0)');
            grad.addColorStop(1, 'rgba(' + STAR_RGB + ',' + sa + ')');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.stroke();
        }
    }

    function loop(t) {
        if (!active) return;
        draw(t);
        raf = requestAnimationFrame(loop);
    }

    function scheduleShoot(first) {
        if (reduced) return;
        clearTimeout(shootTimer);
        var delay = (first ? duskLen + 15000 : 40000) + Math.random() * 100000;
        shootTimer = setTimeout(function () {
            if (active && !document.hidden && !fadingOut) {
                var vw = window.innerWidth;
                shoots.push({
                    x0: vw * (0.08 + Math.random() * 0.84),
                    y0: 16 + Math.random() * 90,
                    dx: (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 150),
                    dy: 40 + Math.random() * 70,
                    t0: performance.now(),
                    life: 600 + Math.random() * 250
                });
            }
            scheduleShoot(false);
        }, delay);
    }

    function start(len) {
        if (active) return true;
        ensureCanvas();
        sizeCanvas();
        if (!buildSky()) return false;
        active = true;
        fadingOut = false;
        duskLen = len;
        duskStart = performance.now();
        try { sessionStorage.setItem('night-fell', '1'); } catch (e) { /* ignore */ }
        if (reduced) {
            draw(performance.now());
        } else {
            raf = requestAnimationFrame(loop);
            scheduleShoot(true);
        }
        return true;
    }

    function deactivate() {
        active = false;
        fadingOut = false;
        cancelAnimationFrame(raf);
        clearTimeout(shootTimer);
        clearTimeout(dayTimer);
        if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    // --- wiring ---
    if (!reduced) {
        window.addEventListener('mousemove', function (e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }, { passive: true });

        document.addEventListener('visibilitychange', function () {
            if (!active || reduced) return;
            if (document.hidden) {
                cancelAnimationFrame(raf);
            } else {
                raf = requestAnimationFrame(loop);
            }
        });

        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (!active) return;
                sizeCanvas();
                if (!buildSky()) deactivate();
            }, 180);
        });

        // Night falls on its own if you stay a while. If it already fell on an
        // earlier page this visit, it's still night out — it returns quickly.
        var fell = false;
        try { fell = !!sessionStorage.getItem('night-fell'); } catch (e) { /* ignore */ }
        autoTimer = setTimeout(function () { start(fell ? 12000 : 70000); },
                               fell ? 3500 + Math.random() * 4000 : 48000 + Math.random() * 27000);
    }

    window.night = function (seconds) {
        if (active) {
            fadingOut = false;       // called mid-sunset: keep the night
            clearTimeout(dayTimer);
            return '☾ already out';
        }
        var ok = start(typeof seconds === 'number' ? Math.max(0, seconds * 1000) : 9000);
        return ok ? '☾ ' + phaseName(moonPhase()) + ' tonight'
                  : '(no room for a sky on this screen)';
    };

    window.day = function () {
        clearTimeout(autoTimer);     // and don't let it fall again on its own
        if (!active) return '☀︎ it is day';
        if (reduced) { deactivate(); return '☀︎ until next time'; }
        fadingOut = true;
        fadeOutStart = performance.now();
        clearTimeout(dayTimer);
        dayTimer = setTimeout(deactivate, 1400); // in case frames are throttled
        return '☀︎ until next time';
    };

    try {
        console.log('%c☾ stay a while — the stars come out around here  (night() if impatient)',
                    'color:#6c757d;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
