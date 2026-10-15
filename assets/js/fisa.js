// PDF Generation using browser print functionality
let previewWindow = null;

const UPDATED_AT_KEY = "fisa-updated-at";

function persistFormData(input, options) {
  const opts = options || {};
  const formData = getFormValues();
  formData.version = 2;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  if (!opts.silent) {
    localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
  }

  // Save Nume separately
  const numeInput = $("#nume");
  localStorage.setItem(USER_NAME_KEY, numeInput.value);

  // Update page title with name and text
  updatePageTitle(formData.nume, formData.text);

  // Notify other modules (ex. cloud sync)
  if (!opts.silent) {
    document.dispatchEvent(new CustomEvent("fisa:change", { detail: { data: formData, source: opts.source || "input" } }));
  }
  return formData;
}

function updatePageTitle(nume, text) {
  document.title = getPageTitle(nume, text) + " - Fișă de lucru";
}

function loadFormData() {
  const data = getPersistedData();
  setFormValues(data);

  // Load Nume separately
  const numeInput = $("#nume");
  const numeVal = localStorage.getItem(USER_NAME_KEY);
  if (numeVal !== null && !data.nume) {
    numeInput.value = numeVal;
  }

  updatePageTitle(numeInput.value, $("#text").value);
}

function clearFormFields(options) {
  const opts = options || {};
  $("form").reset();
  $$("#header-fields input").forEach(input => {
    if (opts.keepName && input.id === "nume") return;
    input.value = "";
  });
  $$(".rich-editor[data-field]").forEach(editor => {
    editor.innerHTML = "";
  });
  $$("input, .rich-editor[data-field]").forEach(el => {
    el.classList.remove("error");
  });
  $$(".error-message").forEach(msg => msg.remove());
  updateProgress();
}

function resetFormData() {
  const hook = window.FisaApp && window.FisaApp.hooks.onReset;
  if (hook && hook() === true) return;

  showCustomAlert(
    "Ești sigur că vrei să ștergi toate câmpurile completate?",
    function () {
      clearFormFields({ keepName: true });
      persistFormData(null, { source: "reset" });
    },
    true
  );
}

function hasContent(data) {
  const values = data || getFormValues();
  return Object.keys(values).some(key => {
    if (key === "version" || key === "date" || key === "nume") return false;
    const v = values[key];
    if (typeof v !== "string") return false;
    const text = v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    return text.length > 0;
  });
}

// Progress tracking
function isStepCompleted(step) {
  const requiredFields = $$("[required], .rich-editor[data-field]:not([data-optional])", step);
  return requiredFields.every(field => {
    const value = field.contentEditable === "true" ? field.textContent : field.value || "";
    return value.trim();
  });
}

function getProgress() {
  const steps = $$(".step:not(.step--notes)");
  let completed = 0;
  let current = 1;
  let currentFound = false;
  steps.forEach((step, i) => {
    const done = isStepCompleted(step);
    step.classList.toggle("is-complete", done);
    if (done) {
      completed++;
    } else if (!currentFound) {
      current = i + 1;
      currentFound = true;
    }
  });
  if (!currentFound) current = steps.length;
  return { completed, total: steps.length, current };
}

function updateProgress() {
  const { completed, total, current } = getProgress();
  const percentage = total ? (completed / total) * 100 : 0;
  const fill = $("#progressFill");
  fill.style.width = percentage + "%";
  fill.classList.toggle("is-complete", completed === total);
  const bar = fill.parentElement;
  if (bar) bar.setAttribute("aria-valuenow", String(completed));
  $("#currentStep").textContent = current;
}

// Form validation
function validateForm() {
  const requiredFields = $$("[required], .rich-editor[data-field]:not([data-optional])");
  let isValid = true;

  // Clear previous errors
  $$(".error").forEach(field => field.classList.remove("error"));
  $$(".error-message").forEach(msg => msg.remove());

  requiredFields.forEach(field => {
    const value = field.contentEditable === "true" ? field.textContent : field.value || "";
    if (!value.trim()) {
      field.classList.add("error");

      const errorMsg = document.createElement("div");
      errorMsg.className = "error-message";
      errorMsg.textContent = "Acest câmp este obligatoriu";
      field.parentNode.appendChild(errorMsg);

      isValid = false;
    }
  });

  if (!isValid) {
    // Scroll to first error
    const firstError = $(".error");
    if (firstError) {
      firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return isValid;
}

// Custom Alert logic
// showCustomAlert(message, onConfirm, isConfirm, options)
// options: { confirmLabel, cancelLabel, onCancel, danger, extraActions: [{label, className, onClick}] }
function showCustomAlert(message, onConfirm, isConfirm, options) {
  const opts = options || {};
  let alertBox = $("#custom-alert");
  if (!alertBox) {
    alertBox = document.createElement("div");
    alertBox.id = "custom-alert";
    alertBox.className = "custom-alert";
    alertBox.setAttribute("role", "dialog");
    alertBox.setAttribute("aria-modal", "true");
    alertBox.innerHTML = `
            <div class="custom-alert-content">
              <span id="custom-alert-message"></span>
              <div class="custom-alert-actions"></div>
            </div>
          `;
    document.body.appendChild(alertBox);
    alertBox.addEventListener("click", e => {
      if (e.target === alertBox && !alertBox.dataset.locked) closeCustomAlert();
    });
  }
  alertBox.style.display = "flex";
  alertBox.dataset.locked = isConfirm ? "1" : "";
  alertBox.querySelector("#custom-alert-message").innerHTML = message;
  const actions = alertBox.querySelector(".custom-alert-actions");
  actions.innerHTML = "";

  const makeBtn = (label, className, handler) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = "btn " + className;
    btn.onclick = function () {
      closeCustomAlert();
      if (handler) handler();
    };
    return btn;
  };

  if (isConfirm) {
    actions.appendChild(makeBtn(opts.cancelLabel || "Nu", "btn-ghost", opts.onCancel));
    (opts.extraActions || []).forEach(a => actions.appendChild(makeBtn(a.label, a.className || "btn-outline", a.onClick)));
    actions.appendChild(makeBtn(opts.confirmLabel || "Da", opts.danger ? "btn-primary btn-danger-solid" : "btn-primary", onConfirm));
  } else {
    actions.appendChild(makeBtn(opts.confirmLabel || "OK", "btn-primary", onConfirm));
  }
  const last = actions.lastElementChild;
  if (last) last.focus();
}

function closeCustomAlert() {
  const alertBox = $("#custom-alert");
  if (alertBox) {
    alertBox.style.display = "none";
  }
}

let toastTimer = null;
function showToast(message, duration) {
  let toast = $("#app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  clearTimeout(toastTimer);
  toast.innerHTML = message;
  toast.style.display = "block";
  toast.style.opacity = "1";
  toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, duration || 3500);
}

function applyImportedData(data, fileName) {
  const hadErrors = $$(".error").length > 0;
  setFormValues(data);
  persistFormData(null, { source: "import" });
  updateProgress();
  // Re-validăm doar dacă erau erori afișate: le ascundem pe cele rezolvate, le păstrăm pe cele rămase.
  if (hadErrors) validateForm();
  const when = data.date ? new Date(data.date).toLocaleString("ro-RO") : "necunoscută";
  showCustomAlert(
    `Fișa a fost încărcată cu succes din <strong>${fileName}</strong>.<br />
    <span class="small">Document modificat la: <strong>${when}</strong></span>`
  );
}

// Load JSON file and populate form
function loadJson() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", function () {
    const file = fileInput.files[0];
    if (!file) {
      document.body.removeChild(fileInput);
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = migrateToV2(JSON.parse(e.target.result));
        const hook = window.FisaApp && window.FisaApp.hooks.onImport;
        if (hook && hook(data, file.name) === true) return;
        applyImportedData(data, file.name);
      } catch (err) {
        console.error("Error loading JSON:", err);
        showCustomAlert("Fișierul selectat nu este un JSON valid.");
      } finally {
        document.body.removeChild(fileInput);
      }
    };
    reader.readAsText(file);
  });

  fileInput.click();
}

function buildJsonExport(values) {
  const date = new Date();
  const data = Object.assign({}, values);
  data.date = date.toISOString();
  data.version = 2;
  const dateStr = date.toLocaleString("sv").slice(0, 16).replace(":", "-").replace(" ", "_");
  const rawName = `${getPageTitle(data["nume"], data["text"])} - ${dateStr} - raw.json`;
  return { json: JSON.stringify(data, null, 2), fileName: getFileName(rawName) };
}

function downloadJson(values) {
  const { json, fileName } = buildJsonExport(values || getFormValues());
  download(json, fileName, "application/json");
}

function renderSteps(steps) {
  const el = $("#cst-steps");
  if (!el) return;

  const stepsHtml = steps
    .map(
      step => `
    <section class="step" id="step-${step.number}">
      <div class="step__head">
        <p class="num-label">Pasul ${step.number}</p>
        <h3>${step.title}</h3>
        ${step.hint ? `<div class="hint">${step.hint}</div>` : ""}
      </div>
      <div class="step__body">
      ${step.questions
        .map(q => {
          const required = q.required ? " required" : "";
          const reqMark = q.required ? ' <span class="required" title="Obligatoriu">*</span>' : "";
          const placeholder = q.placeholder ? q.placeholder.replace(/\n/g, "&#10;") : "";
          const phAttr = placeholder ? ` placeholder="${placeholder}"` : "";
          const phData = placeholder ? ` data-placeholder="${placeholder.replace(/&#10;/g, " / ")}"` : "";
          const field =
            q.type === "text"
              ? `<input type="text" id="${q.field}" name="${q.field}"${required}${phAttr} class="form-group-input" />`
              : `<div class="rich-editor${q.cls ? " " + q.cls : ""}" id="${q.field}" data-field="${q.field}"${q.required ? ' data-required="true"' : ""}${phData} contenteditable="true" autocorrect="off" role="textbox" aria-multiline="true"></div>`;
          return `
        <div class="form-group">
          <label for="${q.field}">
            ${q.label}${reqMark}
          </label>
          ${q.hint ? `<div class="hint">${q.hint}</div>` : ""}
          ${field}
        </div>`;
        })
        .join("")}
      </div>
    </section>`
    )
    .join("");

  el.innerHTML = stepsHtml;
}

function openPreview(autoPrint) {
  persistFormData(null, { silent: true });
  const url = autoPrint ? "print-preview?print=1" : "print-preview";
  if (previewWindow && !previewWindow.closed) {
    if (autoPrint) previewWindow.location.href = url;
    else previewWindow.location.reload();
    previewWindow.focus();
  } else {
    previewWindow = window.open(url, "_blank");
  }
}

function generatePDF() {
  const isValid = validateForm();

  if (isValid) {
    openPreview();
    return;
  }

  // Form is invalid: show countdown in existing alert then open preview
  let remaining = 6;
  const baseMsg =
    "Te rugăm să completezi toate câmpurile obligatorii (marcate cu *) înainte de a salva fișa PDF.<br><br><em>Previzualizarea se va deschide în</em>";
  showCustomAlert(`${baseMsg} <strong>${remaining}s</strong>...`);
  const countInterval = setInterval(() => {
    remaining--;
    const msgEl = $("#custom-alert-message");
    if (remaining > 0 && msgEl) {
      msgEl.innerHTML = `${baseMsg} <strong>${remaining}s</strong>...`;
    } else {
      clearInterval(countInterval);
      closeCustomAlert();
      openPreview();
    }
  }, 1000);
}

function updatePreviewWindow(input) {
  // TODO - optimize by only sending updated field instead of reloading entire preview
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.reload();
  }
}

// Public API for other modules (ex. cloud.js)
window.FisaApp = {
  hooks: {},
  getFormValues,
  setFormValues,
  persistFormData,
  updateProgress,
  getProgress,
  hasContent,
  clearFormFields,
  applyImportedData,
  downloadJson,
  buildJsonExport,
  getPageTitle,
  showCustomAlert,
  closeCustomAlert,
  showToast,
  storageKeys: { STORAGE_KEY, USER_NAME_KEY, UPDATED_AT_KEY }
};

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  renderSteps(STEPS);

  // Load saved form data
  loadFormData();

  const toolbar = renderRichToolbar("#rich-toolbar-wrapper");
  initRichEditorsEvents(toolbar);

  // Update progress on input and save data
  const inputs = $$("input[name], .rich-editor[data-field]");
  inputs.forEach(input => {
    input.addEventListener(
      "input",
      debounce(function () {
        updateProgress();
        persistFormData(input);
        updatePreviewWindow(input);
      }, 300)
    );

    input.addEventListener("blur", function () {
      // Clear error state when field has value
      const value = this.contentEditable === "true" ? this.textContent : this.value || "";
      if (this.classList.contains("error") && value.trim()) {
        this.classList.remove("error");
        const errorMsg = this.parentNode.querySelector(".error-message");
        if (errorMsg) {
          errorMsg.remove();
        }
      }
      persistFormData(input, { silent: true });
    });
  });

  // Reset form button
  $("#resetForm").addEventListener("click", resetFormData);

  $("#loadJson").addEventListener("click", loadJson);
  $("#downloadJson").addEventListener("click", () => downloadJson());

  // Generate PDF button
  $("#generatePDF").addEventListener("click", generatePDF);

  // Ctrl+P / Cmd+P pe formular: deschidem previzualizarea cu tipărire automată, nu formularul brut.
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      openPreview(true);
    }
  });

  // Footer year
  const year = $("#footerYear");
  if (year) year.textContent = String(new Date().getFullYear());

  // Modals (instructions, formatting help)
  const modals = [
    { modal: $("#instructionsModal"), open: $("#openInstructions"), close: $("#closeInstructions") },
    { modal: $("#formattingHelpModal"), open: $("#openFormattingHelp"), close: $("#closeFormattingHelp") }
  ].filter(m => m.modal && m.open && m.close);

  modals.forEach(({ modal, open, close }) => {
    open.addEventListener("click", () => (modal.style.display = "flex"));
    close.addEventListener("click", () => (modal.style.display = "none"));
    modal.addEventListener("click", e => {
      if (e.target === modal || e.target.classList.contains("modal-overlay")) modal.style.display = "none";
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    modals.forEach(({ modal }) => {
      if (modal.style.display === "flex") modal.style.display = "none";
    });
    const alertBox = $("#custom-alert");
    if (alertBox && alertBox.style.display === "flex" && !alertBox.dataset.locked) closeCustomAlert();
  });

  // Initial progress update
  updateProgress();
  document.dispatchEvent(new CustomEvent("fisa:ready"));
});
