// The live page: replays the strokes from demo-data.js in order, shows each answer once its
// expression is written, and opens "Did you mean" for a tapped expression.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var pages = [window.DEMO || [], window.DEMO_ADV || []];   // Basics, Advanced
  var data = pages[0];
  var groups = [];
  var ink = document.getElementById("ink");
  var answersG = document.getElementById("answers");
  var hitsG = document.getElementById("hits");
  var cap = document.getElementById("cap");
  var sheet = document.getElementById("sheet");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var run = 0;            // bumps on replay, so an older run stops
  var selected = -1;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  // a smooth path through the points: quadratic curves between midpoints
  function pathFor(pts) {
    if (pts.length === 1) return "M" + pts[0][0] + " " + pts[0][1] + "l0.01 0";
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += "Q" + pts[i][0] + " " + pts[i][1] + " " + mx.toFixed(1) + " " + my.toFixed(1);
    }
    var last = pts[pts.length - 1];
    return d + "L" + last[0] + " " + last[1];
  }

  // ------------------------------------------------------------ build a page (again on a page switch)
  function build() {
  ink.textContent = ""; answersG.textContent = ""; hitsG.textContent = "";
  groups = data.map(function (g, gi) {
    var paths = g.strokes.map(function (s) { return el("path", { d: pathFor(s) }, ink); });

    var a = el("g", { "class": "answer", "aria-hidden": "true" }, answersG);
    var x = g.anchor[0], y = g.anchor[1], size = g.size;
    if (g.answer && typeof g.answer === "object" && g.answer.frac) {
      var num = g.answer.frac[0], den = g.answer.frac[1];
      var w = Math.max(num.length, den.length) * size * 0.55 + 10;
      var cx = x + 6 + w / 2;
      el("text", { x: cx, y: y - size * 0.42, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central" }, a).textContent = num;
      el("line", { x1: cx - w / 2, y1: y + 1, x2: cx + w / 2, y2: y - 1 }, a);
      el("text", { x: cx, y: y + size * 0.5, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central" }, a).textContent = den;
    } else if (g.answer && typeof g.answer === "object" && g.answer.matrix) {
      // a matrix: cells in columns between two handwritten-looking brackets
      var rows = g.answer.matrix, n = rows.length, rowH = size * 1.25;
      var colW = rows[0].map(function (_, c) {
        return Math.max.apply(null, rows.map(function (r) { return r[c].length; })) * size * 0.5 + size * 0.7;
      });
      var top = y - n * rowH / 2, left = x + 10, wAll = colW.reduce(function (a, b) { return a + b; }, 0);
      function bracket(bx, dir) {
        var pl = el("polyline", { points: [bx + dir * 7, top, bx, top, bx, top + n * rowH, bx + dir * 7, top + n * rowH].join(" ") }, a);
        pl.setAttribute("fill", "none");
      }
      bracket(left, 1);
      rows.forEach(function (r, ri) {
        var cx = left + 6;
        r.forEach(function (cell, ci) {
          el("text", { x: cx + colW[ci] / 2, y: top + (ri + 0.5) * rowH, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central" }, a).textContent = cell;
          cx += colW[ci];
        });
      });
      bracket(left + wAll + 12, -1);
    } else if (g.answer) {
      el("text", { x: x + 4, y: y + 2, "font-size": size, "dominant-baseline": "central" }, a).textContent = g.answer;
    }
    var dot = g.uncertain ? el("circle", { "class": "dot", r: 5, cx: 0, cy: 0 }, answersG) : null;

    var b = g.box, pad = 10;
    var hit = el("rect", {
      "class": "hit", x: b[0] - pad, y: b[1] - pad, width: b[2] + 2 * pad, height: b[3] + 2 * pad, rx: 10,
      tabindex: "0", role: "button", "aria-label": "Show how this was read: " + g.readings.map(function (r) { return r[0]; }).join(", ")
    }, hitsG);
    hit.addEventListener("click", function () { choose(gi); });
    hit.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(gi); } });

    return { paths: paths, answer: a, dot: dot, hit: hit, data: g };
  });

  // lengths for the drawing animation
  groups.forEach(function (g) {
    g.lengths = g.paths.map(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L + 1; return L; });
  });
  }
  build();

  function placeDot(g) {
    if (!g.dot) return;
    var bb = g.answer.getBBox();
    if (!bb.width) { var b = g.data.box; bb = { x: b[0], y: b[1], width: b[2], height: b[3] }; }
    g.dot.setAttribute("cx", bb.x + bb.width + 10);
    g.dot.setAttribute("cy", bb.y + 4);
  }

  function showAll() {
    groups.forEach(function (g) {
      g.paths.forEach(function (p) { p.style.transition = "none"; p.style.strokeDashoffset = 0; });
      g.answer.classList.add("on");
      placeDot(g);
      if (g.dot) g.dot.classList.add("on");
    });
    setCaption("Tap an expression to see how it was read.");
  }

  function resetAll() {
    groups.forEach(function (g, i) {
      g.paths.forEach(function (p, k) { p.style.transition = "none"; p.style.strokeDashoffset = g.lengths[k] + 1; });
      g.answer.classList.remove("on");
      if (g.dot) g.dot.classList.remove("on");
    });
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function setCaption(t) {
    cap.style.opacity = 0;
    setTimeout(function () { cap.textContent = t; cap.style.opacity = 1; }, 180);
  }

  async function play() {
    var me = ++run;
    resetAll();
    void ink.getBoundingClientRect();     // apply the reset before animating
    await wait(400);
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      if (me !== run) return;
      setCaption(g.data.caption);
      for (var k = 0; k < g.paths.length; k++) {
        if (me !== run) return;
        var ms = Math.max(70, Math.min(520, g.lengths[k] * 2.6));
        var p = g.paths[k];
        p.style.transition = "stroke-dashoffset " + ms + "ms cubic-bezier(.4,.1,.6,1)";
        p.style.strokeDashoffset = 0;
        await wait(ms + 45);
      }
      await wait(g.data.answer ? 420 : 900);   // the recognition pause
      if (me !== run) return;
      placeDot(g);
      g.answer.classList.add("on");
      if (g.dot) g.dot.classList.add("on");
      await wait(g.data.answer ? 1500 : 300);
    }
    if (me === run) setCaption("Tap an expression to see how it was read.");
  }

  // ------------------------------------------------------------ Did you mean
  function tex(s, display) {
    if (window.katex) {
      try { return window.katex.renderToString(s, { throwOnError: false, displayMode: !!display }); } catch (e) {}
    }
    var span = document.createElement("span"); span.textContent = s; return span.outerHTML;
  }

  function choose(i) {
    selected = i;
    groups.forEach(function (g, k) { g.hit.classList.toggle("sel", k === i); });
    var g = data[i];
    var body = document.getElementById("dymBody");
    var html = "";
    g.readings.forEach(function (line, li) {
      if (g.readings.length > 1) html += '<div class="line-title">Line ' + (li + 1) + "</div>";
      html += "<ul>";
      line.forEach(function (r, ri) {
        html += '<li class="' + (ri === 0 ? "cur" : "") + '"><span>' + tex(r) + "</span>" +
          (ri === 0 ? '<span class="check" aria-label="current reading">✓</span>' : "") + "</li>";
      });
      html += "</ul>";
    });
    html += '<div class="ans"><div class="line-title" style="margin-top:0">Answer</div>';
    if (g.exact) {
      html += '<div class="k">' + tex(g.exact) + "</div>";
      if (g.approx) html += "<small>≈ " + g.approx + "</small>";
    } else {
      html += '<div class="k" style="color: var(--text-2); font-size: 15px">Remembered for the rest of the page.</div>';
    }
    html += "</div>";
    if (g.uncertain) html += '<div class="uncertain"><i></i>The orange dot means the model wasn’t sure. This is where checking helps.</div>';
    body.innerHTML = html;
    document.getElementById("dym").classList.add("on");
    document.getElementById("tapHint").style.display = "none";
  }

  // ------------------------------------------------------------ paper controls
  function segmented(id, apply) {
    var root = document.getElementById(id);
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      root.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      apply(b.dataset.v);
    });
  }
  segmented("segStyle", function (v) {
    var r = document.getElementById("paperPattern");
    r.setAttribute("fill", v === "blank" ? "transparent" : "url(#" + v + ")");
    document.getElementById("marginLine").setAttribute("visibility", v === "lined" ? "visible" : "hidden");
  });
  segmented("segColor", function (v) { sheet.dataset.color = v; });
  segmented("segPage", function (v) {
    run++;                                   // stop the page being written
    data = pages[+v]; build();
    selected = -1;
    document.getElementById("dym").classList.remove("on");
    document.getElementById("tapHint").style.display = "";
    if (reduce) { showAll(); return; }
    play();
  });

  document.getElementById("replay").addEventListener("click", function () {
    if (reduce) { showAll(); return; }
    play();
  });

  // ------------------------------------------------------------ start when the page is in view
  if (reduce || !("IntersectionObserver" in window)) { showAll(); return; }
  resetAll();
  var started = false;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !started) { started = true; io.disconnect(); play(); }
    });
  }, { threshold: 0.3 });
  io.observe(sheet);
})();
