// A tiny moon-rover runner hiding at the bottom of this page.
// Tap the space bar five times in a row to wake it.
// Space / up to jump, esc to put it back to sleep.
(function () {
    'use strict';

    var INK = '#6c757d';        // rocks, ground, text
    var ROVER_INK = '#495057';
    var H = 150, GROUND = 124;
    var GRAV = 2300, JUMP_V = 540;

    var strip = null, canvas = null, ctx = null;
    var open = false, running = false, dead = false;
    var W = 720;
    var raf = null, lastT = null;

    var rover, obstacles, marks, bgStars, sats;
    var speed, dist, nextSpawn, nextSat, frame, frameT;
    var hi = 0;
    try { hi = parseInt(localStorage.getItem('rover-hi') || '0', 10) || 0; } catch (e) { /* ignore */ }

    function reset() {
        rover = { x: 30, y: GROUND, vy: 0, grounded: true };
        obstacles = [];
        sats = [];
        speed = 250;
        dist = 0;
        nextSpawn = 420;
        nextSat = 4 + Math.random() * 6;
        frame = 0;
        frameT = 0;
        dead = false;
        marks = [];
        bgStars = [];
        var i;
        for (i = 0; i < 14; i++) marks.push({ x: Math.random() * W, y: GROUND + 6 + Math.random() * 12, w: 6 + Math.random() * 14 });
        for (i = 0; i < 16; i++) bgStars.push({ x: Math.random() * W, y: 8 + Math.random() * 80, r: Math.random() < 0.85 ? 1 : 1.5 });
    }

    function score() { return Math.floor(dist / 12); }

    function spawnCluster() {
        var tall = speed > 330 && Math.random() < 0.25;
        var n = Math.random() < 0.55 ? 1 : (Math.random() < 0.7 ? 2 : 3);
        var parts = [];
        var dx = 0;
        for (var i = 0; i < n; i++) {
            var h = tall ? 30 + Math.random() * 8
                         : (Math.random() < 0.6 ? 15 + Math.random() * 9 : 23 + Math.random() * 9);
            var w = 10 + Math.random() * 7;
            parts.push({ dx: dx, w: w, h: h, cap: 0.4 + Math.random() * 0.3 });
            dx += w + 2 + Math.random() * 4;
        }
        obstacles.push({ x: W + 10, w: dx, parts: parts });
    }

    function jump() {
        if (rover.grounded) {
            rover.vy = -JUMP_V;
            rover.grounded = false;
        }
    }

    function act() {
        if (dead) { reset(); running = true; return; }
        if (!running) { running = true; }
        jump();
    }

    function die() {
        dead = true;
        running = false;
        var s = score();
        if (s > hi) {
            hi = s;
            try { localStorage.setItem('rover-hi', String(hi)); } catch (e) { /* ignore */ }
        }
    }

    function update(dt) {
        if (!running || dead) return;

        speed = Math.min(560, speed + 5.5 * dt);
        dist += speed * dt;

        // rover physics
        if (!rover.grounded) {
            rover.vy += GRAV * dt;
            rover.y += rover.vy * dt;
            if (rover.y >= GROUND) {
                rover.y = GROUND;
                rover.vy = 0;
                rover.grounded = true;
            }
        } else {
            frameT += dt;
            if (frameT > 0.09) { frameT = 0; frame = 1 - frame; }
        }

        // obstacles
        nextSpawn -= speed * dt;
        if (nextSpawn <= 0) {
            spawnCluster();
            nextSpawn = 300 + Math.random() * 350 + speed * 0.4;
        }
        var i;
        for (i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= speed * dt;
            if (obstacles[i].x + obstacles[i].w < -20) obstacles.splice(i, 1);
        }

        // decoration
        for (i = 0; i < marks.length; i++) {
            marks[i].x -= speed * dt;
            if (marks[i].x + marks[i].w < 0) {
                marks[i].x = W + Math.random() * 60;
                marks[i].w = 6 + Math.random() * 14;
                marks[i].y = GROUND + 6 + Math.random() * 12;
            }
        }
        for (i = 0; i < bgStars.length; i++) {
            bgStars[i].x -= speed * 0.18 * dt;
            if (bgStars[i].x < 0) { bgStars[i].x = W; bgStars[i].y = 8 + Math.random() * 80; }
        }
        nextSat -= dt;
        if (nextSat <= 0) {
            sats.push({ x: W + 20, y: 16 + Math.random() * 26 });
            nextSat = 7 + Math.random() * 9;
        }
        for (i = sats.length - 1; i >= 0; i--) {
            sats[i].x -= speed * 0.45 * dt;
            if (sats[i].x < -30) sats.splice(i, 1);
        }

        // collision (forgiving hitboxes)
        var rx = rover.x + 4, rw = 24, ry = rover.y - 26, rh = 26;
        for (i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.x > rx + rw || o.x + o.w < rx) continue;
            for (var j = 0; j < o.parts.length; j++) {
                var p = o.parts[j];
                var px = o.x + p.dx + 2, pw = p.w - 4, py = GROUND - p.h + 3, ph = p.h - 3;
                if (rx < px + pw && rx + rw > px && ry < py + ph && ry + rh > py) { die(); return; }
            }
        }
    }

    function drawRover(g) {
        var x = rover.x, y = Math.round(rover.y);
        var air = !rover.grounded;
        var jit = air ? [-1, -1, -1] : (frame ? [0, -1, 0] : [-1, 0, -1]);
        var i, wy;
        g.fillStyle = ROVER_INK;
        for (i = 0; i < 3; i++) {
            wy = y - 8 + jit[i];
            g.fillRect(x + i * 11, wy, 8, 8);
        }
        g.fillStyle = '#ffffff';
        for (i = 0; i < 3; i++) {
            wy = y - 5 + jit[i];
            g.fillRect(x + i * 11 + 3, wy, 2, 2);
        }
        g.fillStyle = ROVER_INK;
        g.fillRect(x - 1, y - 17, 32, 8);     // chassis
        g.fillRect(x + 2, y - 21, 16, 4);     // solar panel
        g.fillStyle = '#ffffff';
        g.fillRect(x + 7, y - 21, 1, 4);
        g.fillRect(x + 12, y - 21, 1, 4);
        g.fillStyle = ROVER_INK;
        g.fillRect(x + 24, y - 26, 3, 9);     // mast
        g.fillRect(x + 21, y - 31, 9, 6);     // camera head
        if (dead) {
            g.fillStyle = '#ffffff';
            g.fillRect(x + 23, y - 29, 2, 2); // x_x
            g.fillRect(x + 26, y - 29, 2, 2);
        } else {
            g.fillStyle = '#ffffff';
            g.fillRect(x + 27, y - 29, 2, 2); // lens, looking ahead
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        var i;

        ctx.fillStyle = 'rgba(108,117,125,0.35)';
        for (i = 0; i < bgStars.length; i++) {
            ctx.fillRect(Math.round(bgStars[i].x), bgStars[i].y, bgStars[i].r, bgStars[i].r);
        }

        ctx.fillStyle = 'rgba(108,117,125,0.55)';
        for (i = 0; i < sats.length; i++) {
            var s = sats[i];
            ctx.fillRect(s.x, s.y, 8, 4);
            ctx.fillRect(s.x - 6, s.y + 1, 5, 2);
            ctx.fillRect(s.x + 9, s.y + 1, 5, 2);
        }

        // ground
        ctx.fillStyle = INK;
        ctx.fillRect(0, GROUND + 1, W, 1.5);
        ctx.fillStyle = 'rgba(108,117,125,0.4)';
        for (i = 0; i < marks.length; i++) {
            ctx.fillRect(Math.round(marks[i].x), marks[i].y, marks[i].w, 1);
        }

        // rocks
        ctx.fillStyle = INK;
        for (i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            for (var j = 0; j < o.parts.length; j++) {
                var p = o.parts[j];
                var bx = Math.round(o.x + p.dx);
                ctx.fillRect(bx, GROUND - p.h * 0.65, p.w, p.h * 0.65 + 1);
                ctx.fillRect(bx + p.w * 0.18, GROUND - p.h, p.w * p.cap + p.w * 0.2, p.h);
            }
        }

        drawRover(ctx);

        // score
        ctx.font = "11px 'Menlo', 'Monaco', monospace";
        ctx.textBaseline = 'top';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(108,117,125,0.6)';
        var sc = String(score());
        while (sc.length < 5) sc = '0' + sc;
        var hs = String(hi);
        while (hs.length < 5) hs = '0' + hs;
        ctx.fillText((hi > 0 ? 'HI ' + hs + '   ' : '') + sc, W - 8, 8);

        ctx.textAlign = 'center';
        if (!running && !dead) {
            ctx.fillStyle = INK;
            ctx.fillText('space to jump  ·  esc to sleep', W / 2, 52);
        } else if (dead) {
            ctx.fillStyle = ROVER_INK;
            ctx.fillText('g a m e  o v e r', W / 2, 44);
            ctx.fillStyle = INK;
            ctx.fillText('space to try again  ·  esc to sleep', W / 2, 62);
        }
    }

    function loop(t) {
        if (!open) return;
        if (lastT === null) lastT = t;
        // fixed-timestep with a catch-up cap, so speed is frame-rate independent
        var elapsed = Math.min(0.1, (t - lastT) / 1000);
        lastT = t;
        while (elapsed > 0) {
            var dt = Math.min(elapsed, 1 / 60);
            update(dt);
            elapsed -= dt;
        }
        draw();
        raf = requestAnimationFrame(loop);
    }

    function sizeCanvas() {
        W = Math.max(280, Math.min(720, window.innerWidth - 48));
        var dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ensureStrip() {
        if (strip) return;
        strip = document.createElement('div');
        var s = strip.style;
        s.position = 'fixed';
        s.left = '0';
        s.right = '0';
        s.bottom = '0';
        s.background = '#ffffff';
        s.borderTop = '1px solid #dee2e6';
        s.boxShadow = '0 -4px 16px rgba(0,0,0,0.04)';
        s.display = 'flex';
        s.justifyContent = 'center';
        s.padding = '10px 0 6px';
        s.zIndex = '1000';
        s.transform = 'translateY(100%)';
        s.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.display = 'block';
        canvas.style.cursor = 'pointer';
        strip.appendChild(canvas);
        document.body.appendChild(strip);
        ctx = canvas.getContext('2d');
        canvas.addEventListener('pointerdown', function () { if (open) act(); });
        window.addEventListener('resize', function () { if (open) { sizeCanvas(); } });
        document.addEventListener('visibilitychange', function () {
            if (!open) return;
            if (document.hidden) { cancelAnimationFrame(raf); lastT = null; }
            else { raf = requestAnimationFrame(loop); }
        });
    }

    function summon() {
        ensureStrip();
        strip.style.visibility = 'visible';
        sizeCanvas();
        reset();
        running = false;
        open = true;
        lastT = null;
        // commit the offscreen position, then slide up
        void strip.offsetHeight;
        strip.style.transform = 'translateY(0)';
        raf = requestAnimationFrame(loop);
    }

    function close() {
        open = false;
        cancelAnimationFrame(raf);
        strip.style.transform = 'translateY(100%)';
        setTimeout(function () { if (!open) strip.style.visibility = 'hidden'; }, 400);
    }

    // five quick taps of the space bar
    var taps = 0, lastTap = 0;
    window.addEventListener('keydown', function (e) {
        if (open) {
            if (e.code === 'Escape') { close(); return; }
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!e.repeat) act();
            }
            return;
        }
        if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        var tag = e.target && e.target.tagName;
        if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
        var now = performance.now();
        if (now - lastTap > 1500) taps = 0;
        taps++;
        lastTap = now;
        if (taps >= 5) {
            taps = 0;
            e.preventDefault();
            summon();
        }
    });

    window.rover = function () {
        if (!open) summon();
        return '␣ to jump · esc to sleep';
    };

    try {
        console.log('%c␣ ␣ ␣ ␣ ␣', 'color:#adb5bd;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
