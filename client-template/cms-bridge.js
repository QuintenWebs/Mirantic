/* ──────────────────────────────────────────────────────────────────────────
 * cms-bridge.js — Mirantic CMS editing bridge
 *
 * Drop this script into every client site you build. It does nothing on a
 * normal visit. When the site is loaded inside the Mirantic CMS editor
 * (in an iframe), it talks to the CMS over postMessage to enable:
 *   - hover highlighting of editable elements
 *   - click-to-select (opens that field in the CMS sidebar)
 *   - live preview of pending edits (text + images) without reloading
 *   - live preview of brand-new blog posts (cloned from a template node)
 *
 * Editable elements are marked with data-cms-field="path.to.value" matching
 * keys in content.json. See README.md in this folder.
 * ────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // Only run inside an iframe.
  if (window.parent === window) return;

  var ACCENT = "#4A6FA5";
  var hostOrigin = "*"; // captured from the first cms-host message
  var editMode = false;
  var imageOverlay = null;
  var styledEl = null;

  injectStyles();
  announceReady();
  window.addEventListener("load", announceReady);
  window.addEventListener("message", onHostMessage);

  function announceReady() {
    post({ source: "cms-bridge", type: "ready" });
  }

  function post(msg) {
    try {
      window.parent.postMessage(msg, hostOrigin);
    } catch (e) {
      /* ignore */
    }
  }

  function onHostMessage(event) {
    var data = event.data;
    if (!data || data.source !== "cms-host") return;
    hostOrigin = event.origin; // trust the host origin from here on

    switch (data.type) {
      case "init":
        enableEditing();
        applyEditMode(data.editMode !== false);
        (data.changes || []).forEach(function (c) {
          applyValue(c.field, c.value, c.fieldType);
        });
        (data.newPosts || []).forEach(function (p) {
          addBlogPost(p.tempId, p.post);
        });
        break;
      case "set-edit-mode":
        applyEditMode(!!data.editMode);
        break;
      case "apply-change":
        applyValue(data.field, data.value, data.fieldType);
        break;
      case "apply-blog-post":
        addBlogPost(data.tempId, data.post);
        break;
      case "remove-blog-post":
        removeBlogPost(data.tempId);
        break;
    }
  }

  // ── Applying values ──────────────────────────────────────────────────────
  function applyValue(field, value, fieldType) {
    var els = document.querySelectorAll('[data-cms-field="' + cssEscape(field) + '"]');
    els.forEach(function (el) {
      setElementValue(el, value, fieldType);
    });
  }

  function setElementValue(el, value, fieldType) {
    var str = value == null ? "" : String(value);
    var isImage =
      fieldType === "image" || el.tagName === "IMG" || el.hasAttribute("data-cms-image");
    if (isImage) {
      if (el.tagName === "IMG") {
        el.src = str;
      } else {
        el.style.backgroundImage = str ? 'url("' + str + '")' : "";
      }
    } else {
      el.textContent = str;
    }
  }

  function readElementValue(el) {
    if (el.tagName === "IMG") return el.getAttribute("src") || "";
    if (el.hasAttribute("data-cms-image")) {
      var m = (el.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/);
      return m ? m[1] : "";
    }
    return (el.textContent || "").trim();
  }

  function fieldTypeOf(el) {
    return el.tagName === "IMG" || el.hasAttribute("data-cms-image") ? "image" : "text";
  }

  // ── Editing interactions ──────────────────────────────────────────────────
  //
  // In browse mode the listeners stay attached but do nothing, so the site's own
  // links work normally and the editor can be used to navigate to the page you
  // actually want to edit.
  function applyEditMode(on) {
    editMode = on;
    document.body.classList.toggle("cms-edit-mode", on);
    if (!on) {
      clearTextOutline();
      hideImageOverlay();
    }
  }

  var listenersAttached = false;
  function enableEditing() {
    if (listenersAttached) return;
    listenersAttached = true;
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", positionImageOverlay, true);
    window.addEventListener("resize", positionImageOverlay, true);
  }

  function editableFrom(target) {
    return target && target.closest ? target.closest("[data-cms-field]") : null;
  }

  function onMouseOver(e) {
    if (!editMode) return;
    var el = editableFrom(e.target);
    if (!el) return;
    if (fieldTypeOf(el) === "image") {
      showImageOverlay(el);
    } else {
      clearTextOutline();
      styledEl = el;
      el.classList.add("cms-hover-text");
    }
  }

  function onMouseOut(e) {
    if (!editMode) return;
    var el = editableFrom(e.target);
    if (!el) return;
    if (fieldTypeOf(el) === "image") {
      hideImageOverlay();
    } else {
      el.classList.remove("cms-hover-text");
    }
  }

  function onClick(e) {
    if (!editMode) return;
    var el = editableFrom(e.target);
    if (!el) return;
    // Prevent the site's own navigation/handlers while editing.
    e.preventDefault();
    e.stopPropagation();
    post({
      source: "cms-bridge",
      type: "field-clicked",
      field: el.getAttribute("data-cms-field"),
      value: readElementValue(el),
      fieldType: fieldTypeOf(el),
    });
  }

  // ── Hover overlay for images ────────────────────────────────────────────
  var overlayTarget = null;
  function showImageOverlay(el) {
    overlayTarget = el;
    if (!imageOverlay) {
      imageOverlay = document.createElement("div");
      imageOverlay.className = "cms-image-overlay";
      imageOverlay.innerHTML =
        '<div class="cms-image-overlay-inner">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
        "</div>";
      document.body.appendChild(imageOverlay);
    }
    imageOverlay.style.display = "block";
    positionImageOverlay();
  }

  function hideImageOverlay() {
    overlayTarget = null;
    if (imageOverlay) imageOverlay.style.display = "none";
  }

  function positionImageOverlay() {
    if (!imageOverlay || !overlayTarget) return;
    var r = overlayTarget.getBoundingClientRect();
    imageOverlay.style.top = r.top + window.scrollY + "px";
    imageOverlay.style.left = r.left + window.scrollX + "px";
    imageOverlay.style.width = r.width + "px";
    imageOverlay.style.height = r.height + "px";
  }

  function clearTextOutline() {
    if (styledEl) styledEl.classList.remove("cms-hover-text");
    styledEl = null;
  }

  // ── Blog posts ─────────────────────────────────────────────────────────
  // Clones the hidden template node [data-cms-template="blog-post"], fills its
  // [data-cms-field] children from the post object, and appends it to the list
  // container ([data-cms-posts], else the template's parent).
  function addBlogPost(tempId, post) {
    removeBlogPost(tempId); // avoid duplicates on re-init
    var template = document.querySelector('[data-cms-template="blog-post"]');
    if (!template) return;

    var node = template.cloneNode(true);
    node.removeAttribute("data-cms-template");
    node.removeAttribute("hidden");
    node.style.display = "";
    node.setAttribute("data-cms-temp-id", tempId);

    node.querySelectorAll("[data-cms-field]").forEach(function (child) {
      var key = child.getAttribute("data-cms-field");
      if (post[key] != null) setElementValue(child, post[key], fieldTypeOf(child));
    });

    var container =
      document.querySelector("[data-cms-posts]") || template.parentNode;
    if (container) container.appendChild(node);
  }

  function removeBlogPost(tempId) {
    var existing = document.querySelector('[data-cms-temp-id="' + cssEscape(tempId) + '"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  // ── Styles ────────────────────────────────────────────────────────────
  function injectStyles() {
    var css =
      ".cms-edit-mode [data-cms-field]{cursor:pointer;}" +
      ".cms-hover-text{outline:2px solid " +
      ACCENT +
      ";outline-offset:2px;border-radius:2px;}" +
      ".cms-image-overlay{position:absolute;z-index:2147483646;display:none;" +
      "background:rgba(74,111,165,0.35);pointer-events:none;border:2px solid " +
      ACCENT +
      ";box-sizing:border-box;}" +
      ".cms-image-overlay-inner{position:absolute;inset:0;display:flex;align-items:center;" +
      "justify-content:center;}";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Minimal CSS.escape fallback for attribute selectors.
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\\]]/g, "\\$&");
  }
})();
