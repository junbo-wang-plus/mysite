// 1D irregular sea for the home-page wave strip.
// JONSWAP spectrum, random phases, deep-water dispersion w^2 = g k,
// optional second-order (sum + difference) correction for unidirectional
// deep water (Longuet-Higgins 1963; Tayfun 1980):
//   eta2 = 1/4 sum_ij a_i a_j [ (k_i+k_j) cos(psi_i+psi_j) - |k_i-k_j| cos(psi_i-psi_j) ]
(function () {
  var strip = document.querySelector('.wave-strip');
  if (!strip) return;
  var fill = strip.querySelector('.wave-fill');
  var d = strip.dataset;
  var Hs = +d.hs || 2, Tp = +d.tp || 8, gamma = +d.gamma || 3.3;
  var nl = (+d.order || 2) >= 2, speed = d.speed != null ? +d.speed : 1, seed = (+d.seed || 7) >>> 0;

  var s = seed;
  function rnd() {
    s = (s + 0x6D2B79F5) >>> 0; var q = s;
    q = Math.imul(q ^ (q >>> 15), q | 1);
    q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  }

  var g = 9.81, wp = 2 * Math.PI / Tp, N = 64;
  var wlo = 0.6 * wp, whi = 3.2 * wp, dw = (whi - wlo) / N;
  var comps = [], m0 = 0, i, j, m;
  for (i = 0; i < N; i++) {
    var w = wlo + (i + rnd()) * dw;
    var sig = w <= wp ? 0.07 : 0.09;
    var r = Math.exp(-((w - wp) * (w - wp)) / (2 * sig * sig * wp * wp));
    var S = Math.pow(w, -5) * Math.exp(-1.25 * Math.pow(wp / w, 4)) * Math.pow(gamma, r);
    m0 += S * dw;
    comps.push({ w: w, k: w * w / g, S: S, ph: 2 * Math.PI * rnd() });
  }
  var scale = Hs / (4 * Math.sqrt(m0)); // Hs = 4 sqrt(m0)
  for (i = 0; i < N; i++) comps[i].a = Math.sqrt(2 * comps[i].S * dw) * scale;

  var L = 6 * g * Tp * Tp / (2 * Math.PI); // ~6 peak wavelengths across the strip
  var M = 240, vs = 20 / Hs;               // svg units per metre (strip is 60 tall)
  var c = new Float64Array(N), sn = new Float64Array(N);

  function frame(t) {
    var pts = new Array(M);
    for (j = 0; j < M; j++) {
      var x = j / (M - 1) * L, eta = 0, Zr = 0, Zi = 0, Wr = 0, Wi = 0;
      for (i = 0; i < N; i++) {
        var p = comps[i], psi = p.k * x - p.w * t + p.ph;
        var ac = p.a * Math.cos(psi), as = p.a * Math.sin(psi);
        c[i] = ac; sn[i] = as; eta += ac;
        if (nl) { Zr += ac; Zi += as; Wr += p.k * ac; Wi += p.k * as; }
      }
      if (nl) {
        var diff = 0;
        for (i = 0; i < N; i++) {
          var ki = comps[i].k;
          for (m = i + 1; m < N; m++) diff += Math.abs(ki - comps[m].k) * (c[i] * c[m] + sn[i] * sn[m]);
        }
        eta += 0.5 * (Wr * Zr - Wi * Zi) - 0.5 * diff;
      }
      var Y = Math.min(59, Math.max(1, 30 - eta * vs));
      pts[j] = (j / (M - 1) * 1000).toFixed(1) + ' ' + Y.toFixed(2);
    }
    fill.setAttribute('d', 'M' + pts.join(' L') + ' L1000 60 L0 60 Z');
  }

  var t = 0;
  frame(t);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !speed) return;

  var last = 0, visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(strip);
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (!last) { last = now; return; }
    var dt = now - last;
    if (dt < 33) return;           // ~30 fps
    last = now;
    if (!visible) return;
    t += Math.min(dt, 100) / 1000 * speed;
    frame(t);
  }
  requestAnimationFrame(tick);
})();
