// Randarea fișei în formatul de tipărire. Folosită de print-preview.html și view.html.
function renderPreview(steps, values, target) {
  const emptyAns = '<span class="empty-answer">Nu a fost completat</span>';

  let html = `
    <div id="header-fields" class="extra-row">
      <span class="extra-label">Nume:</span>
      <span class="extra-value">${values["nume"] || emptyAns}</span>
      <span class="extra-label">Text:</span>
      <span class="extra-value">${values["text"] || emptyAns}</span>
      <span class="extra-label">Publicul țintă:</span>
      <span class="extra-value">${values["target-public"] || emptyAns}</span>
    </div>
  `;

  html += steps
    .map(
      step => `
    <div class="step" id="step-${step.number}">
      <h3>${step.number}. ${step.title}</h3>
      ${step.questions
        .map(
          q => `
        <div class="question">
          ${q.hideLabelInPrint ? "" : `<div class="question-label">${q.label}</div>`}
          <div class="answer">${trimTrailingEmpty(renderContent(values[q.field])) || emptyAns}</div>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  $(target || "#preview-content").innerHTML = html;
}
