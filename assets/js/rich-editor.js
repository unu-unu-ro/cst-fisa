let activeEditor = null;
let savedRange = null;

// TOOLBAR specific code

function updateToolbarState(toolbar) {
  $$(`[data-action]`, toolbar).forEach(btn => {
    try {
      btn.classList.toggle("active", document.queryCommandState(btn.dataset.action));
    } catch (e) {}
  });
}

function getRichToolbarHTML(id) {
  return `
    <div class="rich-toolbar">
      <button type="button" data-action="bold" title="Îngroșat (Ctrl+B)"><strong>B</strong></button>
      <button type="button" data-action="italic" title="Cursiv (Ctrl+I)"><em>I</em></button>
      <button type="button" data-action="underline" title="Subliniat (Ctrl+U)"><u>U</u></button>
      <div class="toolbar-divider"></div>
      <label class="toolbar-color-btn" title="Culoare text">
        <span class="color-swatch tb-forecolor-swatch">A</span>
        <input type="color" name="foreColorPicker" value="#e74c3c" />
      </label>
      <label class="toolbar-color-btn" title="Culoare fundal text">
        <span class="color-swatch tb-bgcolor-swatch bg-swatch">A</span>
        <input type="color" name="bgColorPicker" value="#ffff00" />
      </label>
      <div class="toolbar-divider"></div>
      <button type="button" data-action="insertUnorderedList" title="Listă cu puncte">&#x2630;</button>
      <button type="button" data-action="insertOrderedList" title="Listă numerotată">&#x2116;</button>
      <div class="toolbar-divider"></div>
      <button type="button" data-action="outdent" title="Micșorează indentare (Shift+Tab)">&#8676;</button>
      <button type="button" data-action="indent" title="Mărește indentare (Tab)">&#8677;</button>
    </div>`;
}

function renderRichToolbar(renderTo) {
  const wrapper = $(renderTo);
  if (!wrapper) return;
  wrapper.innerHTML = getRichToolbarHTML();
  const toolbar = $(".rich-toolbar", wrapper);
  initRichToolbarEvents(toolbar);
  initMobileToolbarPin(wrapper);
  return toolbar;
}

function initMobileToolbarPin(wrapper) {
  if (!window.visualViewport) {
    return;
  }

  function pinAboveKeyboard() {
    // Only act on mobile (wrapper is fixed via CSS only at <=600px)
    if (window.innerWidth > 600) {
      return;
    }
    // keyboardHeight = layout viewport - (visual viewport top offset + height)
    const keyboardHeight = window.innerHeight - window.visualViewport.offsetTop - window.visualViewport.height;
    wrapper.style.bottom = Math.max(0, Math.round(keyboardHeight)) + "px";
  }

  function resetPin() {
    if (window.innerWidth > 600) {
      return;
    }
    wrapper.style.bottom = "";
  }

  window.visualViewport.addEventListener("resize", pinAboveKeyboard);
  window.visualViewport.addEventListener("scroll", pinAboveKeyboard);
  window.addEventListener("resize", resetPin);
}

function initRichToolbarEvents(toolbar) {
  const listActions = new Set(["insertUnorderedList", "insertOrderedList"]);

  $$("button[data-action]", toolbar).forEach(btn => {
    const cmd = btn.dataset.action;
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      restoreSelection();
      if (listActions.has(cmd)) {
        expandSelectionToFullBlocks();
      }
      document.execCommand(cmd, false, null);
      updateToolbarState(toolbar);
      notifyEditorChange(activeEditor);
    });
  });

  $$(".toolbar-color-btn", toolbar).forEach(label => {
    label.addEventListener("mousedown", () => saveSelection());
  });

  const foreColorPicker = $("[name='foreColorPicker']", toolbar);
  if (foreColorPicker) {
    foreColorPicker.addEventListener("input", e => {
      restoreSelection();
      document.execCommand("foreColor", false, e.target.value);
      const swatch = $(".tb-forecolor-swatch", toolbar);
      if (swatch) swatch.style.borderBottomColor = e.target.value;
      notifyEditorChange(activeEditor);
    });
  }

  const bgColorPicker = $("[name='bgColorPicker']", toolbar);
  if (bgColorPicker) {
    bgColorPicker.addEventListener("input", e => {
      restoreSelection();
      if (!document.execCommand("hiliteColor", false, e.target.value)) {
        document.execCommand("backColor", false, e.target.value);
      }
      const swatch = $(".tb-bgcolor-swatch", toolbar);
      if (swatch) swatch.style.backgroundColor = e.target.value;
      notifyEditorChange(activeEditor);
    });
  }

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && activeEditor) {
      const range = sel.getRangeAt(0);
      if (activeEditor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
        updateToolbarState(toolbar);
      }
    }
  });
}

// EDITOR specific code

function notifyEditorChange(editor) {
  if (!editor) return;
  const event = new Event("input", { bubbles: true });
  editor.dispatchEvent(event);
}

function getCleanPasteHTML(clipboardData) {
  const html = clipboardData.getData("text/html");
  if (html) {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "br", "span", "div", "blockquote"],
      ALLOWED_ATTR: ["style"]
    });
    const tmp = document.createElement("div");
    tmp.innerHTML = sanitized;
    cleanStyles(tmp);
    return tmp.innerHTML;
  }
  return clipboardData
    .getData("text/plain")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function cleanStyles(el) {
  el.querySelectorAll("[style]").forEach(node => {
    const { color, backgroundColor, margin } = node.style;
    // margin is needed to preserve indentation (ex. blockquote), but we want to remove all other styles
    node.removeAttribute("style");
    if (color) node.style.color = color;
    if (backgroundColor) node.style.backgroundColor = backgroundColor;
    if (margin) node.style.margin = margin;
  });
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

function restoreSelection() {
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

function expandSelectionToFullBlocks() {
  if (!activeEditor) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);

  function getDirectChild(node) {
    while (node && node.parentNode !== activeEditor) {
      node = node.parentNode;
    }
    return node;
  }

  const startBlock = getDirectChild(range.startContainer);
  const endBlock = getDirectChild(range.endContainer);

  if (startBlock) range.setStartBefore(startBlock);
  if (endBlock) range.setEndAfter(endBlock);

  sel.removeAllRanges();
  sel.addRange(range);
}

function initRichEditorsEvents(toolbar) {
  const inputs = $$(".rich-editor[data-field]");

  inputs.forEach(input => {
    input.addEventListener("focus", function () {
      activeEditor = this.dataset.field ? this : null;
      updateToolbarState(toolbar);
    });

    if (input.dataset.field) {
      input.addEventListener("paste", function (e) {
        e.preventDefault();
        document.execCommand("insertHTML", false, getCleanPasteHTML(e.clipboardData));
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
          e.preventDefault();
          if (e.shiftKey) {
            document.execCommand("outdent", false, null);
          } else {
            document.execCommand("indent", false, null);
          }
        }
      });
    }
  });
}
