const codeRanges = {
  "A+": [19, 20],
  A: [16, 18.9],
  "B+": [15, 15.9],
  B: [12, 14.9],
  "C+": [11, 11.9],
  C: [10, 10.9],
  "D+": [9, 9.9],
  D: [8, 8.9],
  E: [0, 7.9],
};

const labs = [];
const codes = Object.keys(codeRanges);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setCookie(name, value, days = 180) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge}`;
}

function getCookie(name) {
  const entry = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  if (!entry) return null;
  return decodeURIComponent(entry.split("=").slice(1).join("="));
}

function makeSelect(name) {
  const select = document.createElement("select");
  select.name = name;
  const opts = [""].concat(codes);
  opts.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c === "" ? "kies" : c;
    select.appendChild(opt);
  });
  select.addEventListener("change", calculate);
  return select;
}

function buildLaboGrid() {
  const tbody = document.getElementById("laboGrid");
  for (let i = 0; i < 6; i++) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = `${i + 1}`;

    const tdVerslag = document.createElement("td");
    const tdPrep = document.createElement("td");

    const verslagSelect = makeSelect(`verslag-${i}`);
    const prepScoreInput = document.createElement("input");
    prepScoreInput.type = "number";
    prepScoreInput.min = "0";
    prepScoreInput.step = "0.1";
    prepScoreInput.value = "";
    prepScoreInput.className = "prep-input";
    prepScoreInput.placeholder = "score";
    prepScoreInput.addEventListener("input", calculate);

    const prepMaxInput = document.createElement("input");
    prepMaxInput.type = "number";
    prepMaxInput.min = "0.01";
    prepMaxInput.step = "0.1";
    prepMaxInput.value = "";
    prepMaxInput.className = "prep-input";
    prepMaxInput.placeholder = "max";
    prepMaxInput.addEventListener("input", calculate);

    tdVerslag.appendChild(verslagSelect);
    tdPrep.append(
      prepScoreInput,
      document.createTextNode(" / "),
      prepMaxInput
    );

    tr.append(tdLabel, tdVerslag, tdPrep);
    tbody.appendChild(tr);
    labs.push({ verslag: verslagSelect, prepScoreInput, prepMaxInput });
  }
}

function readNumber(id, max) {
  const raw = parseFloat(document.getElementById(id).value);
  if (Number.isNaN(raw)) return 0;
  return clamp(raw, 0, max);
}

function calcTotal(partieel, organisch, anorganisch, labo, hasLabo) {
  const examPart =
    (1 / 10) * (partieel / 20) +
    (9 / 10) * ((1 / 3) * (organisch / 35) + (2 / 3) * (anorganisch / 20));
  const weightExam = 5;
  const weightLabo = hasLabo ? 1 : 0;
  const weightTotal = weightExam + weightLabo;
  const weightedSum =
    examPart * weightExam + (hasLabo ? (labo / 20) * weightLabo : 0);
  return weightTotal > 0 ? 20 * (weightedSum / weightTotal) : 0;
}

function calcLaboRange() {
  let sumMin = 0;
  let sumMax = 0;
  let filled = 0;
  const details = [];

  labs.forEach(({ verslag, prepScoreInput, prepMaxInput }, idx) => {
    const vCode = verslag.value;
    const prepScoreRaw = parseFloat(prepScoreInput.value);
    const prepMaxRaw = parseFloat(prepMaxInput.value);
    const prepValid =
      !Number.isNaN(prepScoreRaw) && !Number.isNaN(prepMaxRaw) && prepMaxRaw > 0;
    if (!vCode && !prepValid) return;

    const vRange = codeRanges[vCode] || [0, 0];
    const prepScore = prepValid ? clamp(prepScoreRaw, 0, prepMaxRaw) : 0;
    const prepMax = prepValid ? prepMaxRaw : 0;
    const prepOn20 = prepValid && prepMax > 0 ? (prepScore / prepMax) * 20 : 0;
    const hasVerslag = Boolean(vCode);
    const hasPrep = prepValid;
    const vWeight = hasVerslag ? (hasPrep ? 0.6 : 1) : 0;
    const prepWeight = hasPrep ? (hasVerslag ? 0.4 : 1) : 0;
    const weightSum = vWeight + prepWeight;
    const min =
      weightSum === 0
        ? 0
        : (vWeight * vRange[0] + prepWeight * prepOn20) / weightSum;
    const max =
      weightSum === 0
        ? 0
        : (vWeight * vRange[1] + prepWeight * prepOn20) / weightSum;
    details.push({
      index: idx + 1,
      code: vCode || "—",
      codeRange: vRange,
      prepScore: prepValid ? prepScore : null,
      prepMax: prepValid ? prepMax : null,
      prepProvided: prepValid,
      prepOn20,
      min,
      max,
    });
    sumMin += min;
    sumMax += max;
    filled += 1;
  });

  if (filled === 0) {
    return {
      min: 0,
      max: 0,
      filled,
      sumMin: 0,
      sumMax: 0,
      avgMin: 0,
      avgMax: 0,
      missing: 6,
      details,
    };
  }

  const avgMin = sumMin / filled;
  const avgMax = sumMax / filled;
  const missing = 6 - filled;

  return {
    min: avgMin,
    max: avgMax,
    filled,
    sumMin,
    sumMax,
    avgMin,
    avgMax,
    missing,
    details,
  };
}

function formatRange(min, max) {
  return `${min.toFixed(2)} - ${max.toFixed(2)}`;
}

function saveState() {
  const state = {
    partieel: document.getElementById("partieel").value,
    organisch: document.getElementById("organisch").value,
    anorganisch: document.getElementById("anorganisch").value,
    labs: labs.map(({ verslag, prepScoreInput, prepMaxInput }) => ({
      verslag: verslag.value,
      prepScore: prepScoreInput.value,
      prepMax: prepMaxInput.value,
    })),
  };
  setCookie("chemie-state", JSON.stringify(state));
}

function loadState() {
  const raw = getCookie("chemie-state");
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (parsed.partieel !== undefined)
    document.getElementById("partieel").value = parsed.partieel;
  if (parsed.organisch !== undefined)
    document.getElementById("organisch").value = parsed.organisch;
  if (parsed.anorganisch !== undefined)
    document.getElementById("anorganisch").value = parsed.anorganisch;

  if (Array.isArray(parsed.labs)) {
    parsed.labs.forEach((l, idx) => {
      if (!labs[idx]) return;
      if (l.verslag !== undefined) labs[idx].verslag.value = l.verslag;
      if (l.prepScore !== undefined)
        labs[idx].prepScoreInput.value = l.prepScore;
      if (l.prepMax !== undefined) labs[idx].prepMaxInput.value = l.prepMax;
    });
  }
}

function scoreClass(score) {
  if (score < 8) return "score-low";
  if (score > 10) return "score-high";
  return "score-mid";
}

function updateLatex(partieel, organisch, anorganisch, labo, total, hasLabo) {
  const block = document.getElementById("mathBlock");
  const examPart =
    "\\frac{1}{10}\\cdot\\frac{\\text{Partieel}}{20} + \\frac{9}{10}\\cdot\\big(\\frac{1}{3}\\cdot\\frac{\\text{Organisch}}{35} + \\frac{2}{3}\\cdot\\frac{\\text{Anorganisch}}{20}\\big)";
  const latexGeneral = hasLabo
    ? `\\[\\text{Score} = 20\\cdot\\left(\\frac{5}{6}\\cdot\\Big(${examPart}\\Big) + \\frac{1}{6}\\cdot\\frac{\\text{Labo}}{20}\\right)\\]`
    : `\\[\\text{Score} = 20\\cdot\\Big(${examPart}\\Big)\\]`;

  block.innerHTML = `${latexGeneral}`;
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([block]).catch(() => {});
  }
}

function updateLaboLatex(laboRange) {
  const block = document.getElementById("laboMath");
  if (!block) return;

  const baseLaboScore =
    "\\[\\text{Labo-score} = 20\\cdot\\frac{6}{10}\\cdot \\text{Verslag} + \\frac{4}{10}\\cdot \\text{Attitude}\\]";

  block.innerHTML = `${baseLaboScore}`;
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([block]).catch(() => {});
  }
}

function updateLaboScoreDisplay(laboRange) {
  const el = document.getElementById("LaboScore");
  if (!el) return;
  const min = laboRange.min;
  const max = laboRange.max;
  const avg = (min + max) / 2;
  el.innerHTML = `Labo score:<br><span class="score-value">${min.toFixed(
    2
  )} - ${max.toFixed(2)} / 20</span>`;
  el.classList.remove("score-low", "score-mid", "score-high", "score-neutral");
  if (laboRange.filled === 0) {
    el.classList.add("score-neutral");
  } else {
    el.classList.add(scoreClass(avg));
  }
}

function calculate() {
  const partieel = readNumber("partieel", 20);
  const organisch = readNumber("organisch", 35);
  const anorganisch = readNumber("anorganisch", 20);

  const laboRange = calcLaboRange();
  const laboAvg = (laboRange.min + laboRange.max) / 2;
  const hasLabo = laboRange.filled > 0;
  const totalMin = calcTotal(
    partieel,
    organisch,
    anorganisch,
    laboRange.min,
    hasLabo
  );
  const totalMax = calcTotal(
    partieel,
    organisch,
    anorganisch,
    laboRange.max,
    hasLabo
  );
  const avgScore = (totalMin + totalMax) / 2;
  const defaultState =
    partieel === 0 &&
    organisch === 0 &&
    anorganisch === 0 &&
    laboRange.filled === 0;

  const resultEl = document.getElementById("Result");
  resultEl.textContent = `Score: ${avgScore.toFixed(2)} / 20`;
  resultEl.classList.remove("score-low", "score-mid", "score-high", "score-neutral");
  if (defaultState) {
    resultEl.classList.add("score-neutral");
  } else {
    resultEl.classList.add(scoreClass(avgScore));
  }

  document.getElementById("ResultRange").textContent = `Min: ${totalMin.toFixed(
    2
  )} / 20 | Max: ${totalMax.toFixed(2)} / 20`;

  updateLatex(partieel, organisch, anorganisch, laboAvg, avgScore, hasLabo);
  updateLaboLatex(laboRange);
  updateLaboScoreDisplay(laboRange);
  saveState();
}

function openLaboModal() {
  const modal = document.getElementById("laboModal");
  if (!modal) return;
  modal.classList.add("open");
  calculate();
}

function closeLaboModal() {
  const modal = document.getElementById("laboModal");
  if (!modal) return;
  modal.classList.remove("open");
}

function buildCodesTable() {
  const tbody = document.getElementById("codesGrid");
  if (!tbody) return;
  tbody.innerHTML = "";
  Object.entries(codeRanges).forEach(([code, [min, max]]) => {
    const tr = document.createElement("tr");
    const tdCode = document.createElement("td");
    tdCode.textContent = code;
    const tdMin = document.createElement("td");
    tdMin.textContent = min.toFixed(1);
    const tdMax = document.createElement("td");
    tdMax.textContent = max.toFixed(1);
    tr.append(tdCode, tdMin, tdMax);
    tbody.appendChild(tr);
  });
}

function openCodesModal() {
  const modal = document.getElementById("codesModal");
  if (!modal) return;
  buildCodesTable();
  modal.classList.add("open");
}

function closeCodesModal() {
  const modal = document.getElementById("codesModal");
  if (!modal) return;
  modal.classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  buildLaboGrid();
  loadState();
  document.getElementById("calculate").addEventListener("click", calculate);
  document.getElementById("partieel").addEventListener("input", calculate);
  document.getElementById("organisch").addEventListener("input", calculate);
  document.getElementById("anorganisch").addEventListener("input", calculate);
  document
    .getElementById("openLaboModal")
    .addEventListener("click", openLaboModal);
  document
    .getElementById("openCodesModal")
    .addEventListener("click", openCodesModal);
  document
    .getElementById("closeLaboModal")
    .addEventListener("click", closeLaboModal);
  document
    .getElementById("closeCodesModal")
    .addEventListener("click", closeCodesModal);
  document
    .getElementById("laboModal")
    .addEventListener("click", (evt) => {
      if (evt.target.dataset.close === "true") closeLaboModal();
    });
  document.getElementById("codesModal").addEventListener("click", (evt) => {
    if (evt.target.dataset.close === "true") closeCodesModal();
  });
  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      closeLaboModal();
      closeCodesModal();
    }
  });
  calculate();
});
