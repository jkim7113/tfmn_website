// The floating navigation bar: lighter glass once the page (not the dark banner) is under it,
// and the title capsule shown only after the page's large title has scrolled under the bar.
// The title capsule splits off the links capsule like the Dynamic Island splitting in two:
// nav.js measures its full width (--brand-w) and how far right it starts (--brand-dx).
(function () {
  "use strict";
  var nav = document.getElementById("navbar");
  var banner = document.querySelector(".banner");
  var title = document.querySelector(".banner h1");
  var brand = nav && nav.querySelector(".brand");
  var label = brand && brand.querySelector("span");
  var links = nav && nav.querySelector(".toplinks");
  if (!nav || !banner) return;
  var ticking = false;
  var hidden = null;

  function measure() {
    if (!brand || !label) return;
    var cs = getComputedStyle(brand);
    var w = label.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    brand.style.setProperty("--brand-w", Math.ceil(w) + "px");
    if (links) {
      // hidden, the pill (as wide as the bar is tall) sits tucked 16 px under the links capsule
      var pill = brand.offsetHeight;
      var dx = links.offsetLeft - brand.offsetLeft - pill + 16;
      brand.style.setProperty("--brand-dx", Math.max(0, Math.round(dx)) + "px");
    }
  }

  function bump(cls) {
    if (!links || nav.classList.contains("no-anim")) return;
    links.classList.remove("pull", "absorb");
    void links.offsetWidth;                       // restart the animation
    links.classList.add(cls);
  }

  function update() {
    ticking = false;
    var bar = nav.getBoundingClientRect().bottom;
    nav.classList.toggle("over-page", banner.getBoundingClientRect().bottom < bar - 23);
    if (!title) return;
    var h = title.getBoundingClientRect().bottom > bar;
    if (h !== hidden) {
      if (hidden !== null) bump(h ? "absorb" : "pull");
      hidden = h;
      nav.classList.toggle("title-hidden", h);
    }
  }

  // phones: one menu button in the links capsule, and a glass menu holding every link
  if (links) {
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "menu-btn";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "site-menu");
    btn.innerHTML = "<i></i><i></i><i></i>";
    links.appendChild(btn);
    var menu = document.createElement("nav");
    menu.className = "menu glass"; menu.id = "site-menu";
    menu.setAttribute("aria-label", "Site menu");
    links.querySelectorAll("a").forEach(function (a) {
      var c = a.cloneNode(true); c.className = ""; c.tabIndex = -1; menu.appendChild(c);
    });
    links.parentNode.appendChild(menu);
    var setOpen = function (open) {
      nav.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      menu.querySelectorAll("a").forEach(function (a) { a.tabIndex = open ? 0 : -1; });
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !nav.classList.contains("menu-open");
      setOpen(open);
      if (open && e.detail === 0) { var f = menu.querySelector("a"); if (f) f.focus({ preventScroll: true }); }   // keyboard only
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("menu-open") && !menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("menu-open")) { setOpen(false); btn.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 560) setOpen(false); });
  }

  if (links) links.addEventListener("animationend", function () { links.classList.remove("pull", "absorb"); });

  // start in the right state without animating into it
  nav.classList.add("no-anim");
  measure();
  update();
  void nav.offsetWidth;                           // apply the start state first
  setTimeout(function () { nav.classList.remove("no-anim"); }, 60);

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", function () { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);   // Playfair changes the width
})();
