function $(selector, parent) {
  return (parent || document).querySelector(selector);
}

function $$(selector, parent) {
  return [...(parent || document).querySelectorAll(selector)];
}

function debounce(fn, delay) {
  let timer = null;
  return function () {
    const context = this,
      args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}

function download(text, name, type) {
  const anchor = document.createElement("a");
  anchor.className = "download-js-link";
  anchor.id = "download-html";
  anchor.innerHTML = "downloading...";
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  const file = new Blob([text], { type: type });
  anchor.href = URL.createObjectURL(file);
  anchor.download = name;
  anchor.click();
  document.body.removeChild(anchor);
}

function getFileName(name) {
  return (name || "filename").replace(/\\|\:|\/|\*|\?|\<|\>\|/gi, "_");
}

function getFormValues() {
  const data = {};
  $$("input[name]").forEach(input => {
    data[input.name] = input.value;
  });
  $$(".rich-editor[data-field]").forEach(editor => {
    let html = editor.innerHTML.trim();
    if (!html || html === "<p><br></p>" || html === "<br>" || editor.innerText.trim() === "") {
      html = "";
    }
    data[editor.dataset.field] = html;
  });
  return data;
}

function setFormValues(data) {
  Object.keys(data).forEach(name => {
    const input = $(`input[name="${name}"]`);
    if (input) {
      input.value = data[name] || "";
      return;
    }
    const editor = $(`.rich-editor[data-field="${name}"]`);
    if (editor) {
      editor.innerHTML = window.DOMPurify.sanitize(data[name] || "");
    }
  });
}
