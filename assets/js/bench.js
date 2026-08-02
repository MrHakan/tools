/* ==========================================================================
   Bench — shared runtime for every tool page.
   Loaded with `defer`. Exposes a single global: `Bench`.
   Everything here runs client-side; no tool on this site sends data anywhere.
   ========================================================================== */

(function (global) {
  "use strict";

  /* --- dom ---------------------------------------------------------------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** Escape a string for safe interpolation into innerHTML. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* --- feedback ----------------------------------------------------------- */

  var toastHost = null;

  function toast(msg, kind) {
    if (!toastHost) {
      toastHost = el("div", { class: "toasts", "aria-live": "polite" });
      document.body.appendChild(toastHost);
    }
    var t = el("div", { class: "toast" + (kind === "bad" ? " toast--bad" : ""), text: msg });
    toastHost.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity .2s ease";
      t.style.opacity = "0";
      setTimeout(function () { t.remove(); }, 220);
    }, 1700);
  }

  /* --- clipboard ---------------------------------------------------------- */

  function copy(text, btn) {
    text = String(text == null ? "" : text);
    if (!text) { toast("Nothing to copy", "bad"); return Promise.resolve(false); }

    var done = function () {
      if (btn) {
        var was = btn.dataset.label || btn.textContent;
        btn.dataset.label = was;
        btn.textContent = "Copied";
        btn.classList.add("btn--on");
        setTimeout(function () {
          btn.textContent = was;
          btn.classList.remove("btn--on");
        }, 1200);
      } else {
        toast("Copied to clipboard");
      }
      return true;
    };

    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done).catch(function () { return legacy(); });
    }
    return Promise.resolve(legacy());

    function legacy() {
      var ta = el("textarea", { style: "position:fixed;top:-9999px;opacity:0" });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      if (!ok) { toast("Copy failed — select the text and press Ctrl+C", "bad"); return false; }
      return done();
    }
  }

  /**
   * Wire every `[data-copy]` button in `root`. The attribute value is a
   * selector; the button copies that element's value or textContent.
   */
  function wireCopy(root) {
    $$("[data-copy]", root).forEach(function (btn) {
      if (btn.dataset.copyWired) return;
      btn.dataset.copyWired = "1";
      btn.addEventListener("click", function () {
        var src = $(btn.dataset.copy);
        if (!src) return;
        copy("value" in src ? src.value : src.textContent, btn);
      });
    });
  }

  /* --- files -------------------------------------------------------------- */

  function download(filename, content, mime) {
    var blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast("Saved " + filename);
  }

  function readFile(file, as) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("Could not read " + file.name)); };
      if (as === "dataURL") r.readAsDataURL(file);
      else if (as === "buffer") r.readAsArrayBuffer(file);
      else r.readAsText(file);
    });
  }

  /**
   * Turn an element into a drop target. `onFiles` receives a FileList.
   * Returns a teardown function.
   */
  function dropzone(node, onFiles) {
    var stop = function (e) { e.preventDefault(); e.stopPropagation(); };
    var enter = function (e) { stop(e); node.classList.add("is-drop"); };
    var leave = function (e) { stop(e); node.classList.remove("is-drop"); };
    var drop = function (e) {
      stop(e);
      node.classList.remove("is-drop");
      if (e.dataTransfer && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    };
    ["dragenter", "dragover"].forEach(function (t) { node.addEventListener(t, enter); });
    ["dragleave", "dragend"].forEach(function (t) { node.addEventListener(t, leave); });
    node.addEventListener("drop", drop);
    return function () {
      ["dragenter", "dragover"].forEach(function (t) { node.removeEventListener(t, enter); });
      ["dragleave", "dragend"].forEach(function (t) { node.removeEventListener(t, leave); });
      node.removeEventListener("drop", drop);
    };
  }

  /* --- storage ------------------------------------------------------------ */

  /**
   * Namespaced localStorage that degrades to memory when storage is blocked
   * (private mode, third-party frame) instead of throwing mid-tool.
   */
  function store(ns) {
    var prefix = "bench:" + ns + ":";
    var mem = {};
    var live = (function () {
      try {
        var k = "bench:probe";
        localStorage.setItem(k, "1");
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    })();

    return {
      available: live,
      get: function (key, fallback) {
        try {
          var raw = live ? localStorage.getItem(prefix + key) : mem[key];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        var raw = JSON.stringify(value);
        try {
          if (live) localStorage.setItem(prefix + key, raw);
          else mem[key] = raw;
          return true;
        } catch (e) {
          toast("Storage is full — some changes were not saved", "bad");
          return false;
        }
      },
      remove: function (key) {
        try { if (live) localStorage.removeItem(prefix + key); else delete mem[key]; } catch (e) {}
      },
      clear: function () {
        try {
          if (!live) { mem = {}; return; }
          Object.keys(localStorage)
            .filter(function (k) { return k.indexOf(prefix) === 0; })
            .forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) {}
      }
    };
  }

  /* --- timing ------------------------------------------------------------- */

  function debounce(fn, ms) {
    var t;
    return function () {
      var self = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms == null ? 160 : ms);
    };
  }

  /**
   * Run `fn` on input, immediately and on every change. The workhorse of a
   * live tool: `Bench.live(input, render)`.
   */
  function live(node, fn, ms) {
    var run = ms ? debounce(fn, ms) : fn;
    ["input", "change"].forEach(function (t) { node.addEventListener(t, run); });
    fn();
  }

  /* --- formatting --------------------------------------------------------- */

  function bytes(n) {
    if (!isFinite(n) || n < 0) return "—";
    var u = ["B", "KB", "MB", "GB"], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n < 10 ? 2 : 1)) + " " + u[i];
  }

  function num(n, digits) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 0 : digits
    });
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : (many || one + "s"));
  }

  /* --- crypto ------------------------------------------------------------- */

  /** Cryptographically strong random integer in [0, max). */
  function randInt(max) {
    var a = new Uint32Array(1);
    var limit = Math.floor(0xffffffff / max) * max;
    do { crypto.getRandomValues(a); } while (a[0] >= limit);
    return a[0] % max;
  }

  function randPick(arr) { return arr[randInt(arr.length)]; }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
  }

  /* --- theme -------------------------------------------------------------- */

  var THEME_KEY = "bench:theme";

  function applyTheme(mode) {
    if (mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
    else document.documentElement.removeAttribute("data-theme");
    $$("[data-theme-toggle]").forEach(function (b) {
      b.textContent = mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐";
      b.title = "Theme: " + (mode || "system") + " — click to change";
    });
  }

  function initTheme() {
    var saved;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }
    applyTheme(saved);
    $$("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var now = document.documentElement.getAttribute("data-theme");
        var next = now === "light" ? "dark" : now === "dark" ? null : "light";
        try {
          if (next) localStorage.setItem(THEME_KEY, next);
          else localStorage.removeItem(THEME_KEY);
        } catch (e) {}
        applyTheme(next);
      });
    });
  }

  /* --- boot --------------------------------------------------------------- */

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    initTheme();
    wireCopy(document);
  });

  global.Bench = {
    $: $, $$: $$, el: el, esc: esc, ready: ready,
    toast: toast, copy: copy, wireCopy: wireCopy,
    download: download, readFile: readFile, dropzone: dropzone,
    store: store, debounce: debounce, live: live,
    bytes: bytes, num: num, plural: plural,
    randInt: randInt, randPick: randPick, uuid: uuid
  };
})(window);
