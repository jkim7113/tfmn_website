// "Three steps, no buttons": one iPad frame plays the chosen step's recording. Steps play in turn
// while the section is on screen, and tapping a step plays it. With reduced motion nothing plays
// by itself: tapping a step shows that recording with its controls.
(function () {
  "use strict";
  var list = document.getElementById("steps");
  var video = document.getElementById("stepVideo");
  if (!list || !video) return;
  var items = Array.prototype.slice.call(list.querySelectorAll("li"));
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cur = 0, inView = false, raf = 0;

  list.classList.add("live");
  if (reduce) video.controls = true;

  function bar(i) { return items[i].querySelector(".bar i"); }

  function tick() {
    raf = 0;
    var d = video.duration;
    if (d) bar(cur).style.transform = "scaleX(" + Math.min(1, video.currentTime / d) + ")";
    if (!video.paused && !video.ended) raf = requestAnimationFrame(tick);
  }
  function startTick() { if (!raf) raf = requestAnimationFrame(tick); }

  function play() {
    var p = video.play();
    if (p && p.catch) p.catch(function () {});   // autoplay refused: the poster stays
  }

  function show(i, autoplay) {
    cur = i;
    items.forEach(function (li, k) {
      li.classList.toggle("on", k === i);
      li.querySelector("button").setAttribute("aria-pressed", k === i ? "true" : "false");
      bar(k).style.transform = "scaleX(0)";
    });
    var base = items[i].querySelector("button").dataset.v;
    video.poster = base + ".jpg";
    video.src = base + ".mp4";
    if (autoplay) play();
  }

  items.forEach(function (li, k) {
    li.querySelector("button").addEventListener("click", function () {
      if (k === cur && !video.ended) { video.currentTime = 0; play(); return; }
      show(k, true);
    });
  });

  video.addEventListener("play", startTick);
  video.addEventListener("timeupdate", startTick);
  video.addEventListener("ended", function () {
    bar(cur).style.transform = "scaleX(1)";
    if (reduce) return;
    setTimeout(function () {
      if (!video.ended) return;                  // the reader picked another step meanwhile
      show((cur + 1) % items.length, inView);
    }, 900);                                     // a moment on the finished page
  });

  if (reduce || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      inView = e.isIntersecting;
      if (inView) { if (video.paused && !video.ended) play(); }
      else video.pause();
    });
  }, { threshold: 0.4 }).observe(video);
})();
