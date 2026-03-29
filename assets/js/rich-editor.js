let activeEditor = null;
let savedRange = null;

function updateToolbarState() {
  const stateMap = {
    bold: "tb-bold",
    italic: "tb-italic",
    underline: "tb-underline",
    insertUnorderedList: "tb-ul",
    insertOrderedList: "tb-ol"
  };
  Object.entries(stateMap).forEach(([cmd, id]) => {
    const btn = $("#" + id);
    if (btn) {
      try {
        btn.classList.toggle("active", document.queryCommandState(cmd));
      } catch (e) {}
    }
  });
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
    console.debug("margin", margin);
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

function getRichToolbarHTML() {
  return `
    <div id="rich-toolbar" class="rich-toolbar">
      <button type="button" id="tb-bold" title="Îngroșat (Ctrl+B)"><strong>B</strong></button>
      <button type="button" id="tb-italic" title="Cursiv (Ctrl+I)"><em>I</em></button>
      <button type="button" id="tb-underline" title="Subliniat (Ctrl+U)"><u>U</u></button>
      <div class="toolbar-divider"></div>
      <label class="toolbar-color-btn" title="Culoare text">
        <span id="tb-forecolor-swatch" class="color-swatch">A</span>
        <input type="color" id="foreColorPicker" value="#e74c3c" />
      </label>
      <label class="toolbar-color-btn" title="Culoare fundal text">
        <span id="tb-bgcolor-swatch" class="color-swatch bg-swatch">A</span>
        <input type="color" id="bgColorPicker" value="#ffff00" />
      </label>
      <div class="toolbar-divider"></div>
      <button type="button" id="tb-ul" title="Listă cu puncte">&#x2630;</button>
      <button type="button" id="tb-ol" title="Listă numerotată">&#x2116;</button>
      <div class="toolbar-divider"></div>
      <button type="button" id="tb-outdent" title="Micșorează indentare (Shift+Tab)">&#8676;</button>
      <button type="button" id="tb-indent" title="Mărește indentare (Tab)">&#8677;</button>
    </div>`;
}

function renderRichToolbar() {
  const wrapper = $(".rich-toolbar-wrapper");
  if (!wrapper) return;
  wrapper.innerHTML = getRichToolbarHTML();
}

function initRichToolbar() {
  const simpleCommands = {
    "tb-bold": "bold",
    "tb-italic": "italic",
    "tb-underline": "underline",
    "tb-indent": "indent",
    "tb-outdent": "outdent"
  };

  Object.entries(simpleCommands).forEach(([id, cmd]) => {
    const btn = $("#" + id);
    if (!btn) return;
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      restoreSelection();
      document.execCommand(cmd, false, null);
      updateToolbarState();
      if (activeEditor) persistFormData(activeEditor);
    });
  });

  ["tb-ul", "tb-ol"].forEach(id => {
    const btn = $("#" + id);
    if (!btn) return;
    const cmd = id === "tb-ul" ? "insertUnorderedList" : "insertOrderedList";
    btn.addEventListener("mousedown", e => {
      e.preventDefault();
      restoreSelection();
      expandSelectionToFullBlocks();
      document.execCommand(cmd, false, null);
      updateToolbarState();
      if (activeEditor) persistFormData(activeEditor);
    });
  });

  $$(".toolbar-color-btn").forEach(label => {
    label.addEventListener("mousedown", () => saveSelection());
  });

  const foreColorPicker = $("#foreColorPicker");
  if (foreColorPicker) {
    foreColorPicker.addEventListener("input", e => {
      restoreSelection();
      document.execCommand("foreColor", false, e.target.value);
      const swatch = $("#tb-forecolor-swatch");
      if (swatch) swatch.style.borderBottomColor = e.target.value;
      if (activeEditor) persistFormData(activeEditor);
    });
  }

  const bgColorPicker = $("#bgColorPicker");
  if (bgColorPicker) {
    bgColorPicker.addEventListener("input", e => {
      restoreSelection();
      if (!document.execCommand("hiliteColor", false, e.target.value)) {
        document.execCommand("backColor", false, e.target.value);
      }
      const swatch = $("#tb-bgcolor-swatch");
      if (swatch) swatch.style.backgroundColor = e.target.value;
      if (activeEditor) persistFormData(activeEditor);
    });
  }

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && activeEditor) {
      const range = sel.getRangeAt(0);
      if (activeEditor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
        updateToolbarState();
      }
    }
  });
}
