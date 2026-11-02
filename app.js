(function () {
  "use strict";

  if (document.documentElement.classList.contains("mode-closed")) return;

  /* ============================================================
     Данные
     ============================================================ */

  var TEST = [
    {
      q: "Равнозначный перекрёсток. Вы и машина справа подъехали одновременно, оба едете прямо. Кто уступает?",
      o: ["Вы", "Водитель справа", "Кто первым посигналил"],
      c: 0,
      exp: "При одинаковых правах уступает тот, у кого угроза удара в правый борт, — то есть вы."
    },
    {
      q: "Вы разворачиваетесь. Встречный автомобиль едет прямо. Кто уступает?",
      o: ["Вы", "Встречный", "Кто ближе к центру перекрёстка"],
      c: 0,
      exp: "При повороте налево и развороте уступаем встречным транспортным средствам, движущимся прямо."
    },
    {
      q: "Вы не уверены, главная у вас дорога или второстепенная. Как действуете?",
      o: ["Считаете себя на второстепенной и уступаете", "Едете первым, пока не доказано обратное", "Сигналите, чтобы вас пропустили"],
      c: 0,
      exp: "Если определить приоритет нельзя, водитель должен считать, что находится на второстепенной дороге."
    }
  ];

  /* ============================================================
     Хранилище
     ============================================================ */

  var KEY = "perekrestok-v1";

  var store = {
    get: function (k, def) {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return def;
        var obj = JSON.parse(raw);
        return obj && obj[k] !== undefined ? obj[k] : def;
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try {
        var raw = localStorage.getItem(KEY);
        var obj = raw ? JSON.parse(raw) : {};
        obj[k] = v;
        localStorage.setItem(KEY, JSON.stringify(obj));
      } catch (e) { /* приватный режим */ }
    }
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ============================================================
     Навигация и прогресс
     ============================================================ */

  var sections = $$(".section");
  var navEl = $("#nav");
  var progressFill = $("#progress-fill");
  var progressText = $("#progress-text");
  var sidebarMeta = $("#sidebar-meta");

  var visited = store.get("visited", []);
  var testDone = store.get("lastTest", null);

  function isVisited(id) { return visited.indexOf(id) !== -1; }

  function buildNav() {
    sections.forEach(function (sec, i) {
      var id = sec.id;
      var title = sec.dataset.title || ("Раздел " + (i + 1));
      var btn = document.createElement("a");
      btn.href = "#" + id;
      btn.className = "nav-item";
      btn.dataset.target = id;
      btn.innerHTML = '<span class="nav-item__dot">' + (i + 1) + "</span><span>" + title + "</span>";
      navEl.appendChild(btn);
    });
  }

  function updateProgress() {
    var total = sections.length;
    var done = sections.filter(function (s) { return isVisited(s.id); }).length;
    var pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
    progressText.textContent = pct + "%";
    updateMeta(done, total);
  }

  function updateMeta(done, total) {
    var html = "<b>Изучено:</b> " + done + " из " + total + " разделов";
    if (testDone) {
      html += "<br><b>Проверка:</b> " + testDone.score + " / " + testDone.total;
    } else {
      html += "<br>Проверка ещё не пройдена";
    }
    sidebarMeta.innerHTML = html;
  }

  function setActive(id) {
    $$(".nav-item").forEach(function (n) {
      n.classList.toggle("is-active", n.dataset.target === id);
    });
  }

  function markVisited(id) {
    if (!isVisited(id)) {
      visited.push(id);
      store.set("visited", visited);
      var item = $('.nav-item[data-target="' + id + '"]');
      if (item) item.classList.add("is-done");
      updateProgress();
    }
  }

  function initNav() {
    buildNav();
    visited.forEach(function (id) {
      var item = $('.nav-item[data-target="' + id + '"]');
      if (item) item.classList.add("is-done");
    });
    updateProgress();

    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            setActive(e.target.id);
            markVisited(e.target.id);
          }
        });
      }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
      sections.forEach(function (s) { obs.observe(s); });
    }
  }

  /* ============================================================
     «Проверьте себя»
     ============================================================ */

  $$(".check__reveal").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var a = btn.parentElement.querySelector(".check__a");
      if (a) a.hidden = false;
      btn.hidden = true;
    });
  });

  /* ============================================================
     Дерево «Назовите перекрёсток»
     ============================================================ */

  (function initTree() {
    var tree = $("#tree");
    if (!tree) return;

    var levels = $$(".tree__level", tree);
    var results = $$("[data-result]", tree);

    $$(".tree__btn", tree).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.dataset.next;
        var current = btn.closest(".tree__level");
        var index = levels.indexOf(current);
        var next = tree.querySelector('[data-level="' + key + '"]');

        $$(".tree__btn", btn.parentElement).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });

        results.forEach(function (r) {
          r.hidden = r.dataset.result !== key;
        });

        levels.forEach(function (l, i) {
          if (i <= index) l.hidden = false;
          else l.hidden = l !== next;
        });
      });
    });
  })();

  /* ============================================================
     Проверка
     ============================================================ */

  (function initTest() {
    var startBox = $("#test-start");
    var runBox = $("#test-run");
    var resultBox = $("#test-result");
    if (!startBox) return;

    var beginBtn = $("#test-begin");
    var lastEl = $("#test-last");
    var qEl = $("#test-q");
    var optsEl = $("#test-options");
    var feedbackEl = $("#test-feedback");
    var fillEl = $("#test-fill");
    var counterEl = $("#test-counter");
    var prevBtn = $("#test-prev");
    var nextBtn = $("#test-next");
    var scoreEl = $("#result-score");
    var verdictEl = $("#result-verdict");
    var listEl = $("#result-list");
    var retryBtn = $("#test-retry");

    var answers = [];
    var idx = 0;

    if (testDone) {
      lastEl.textContent = "В прошлый раз: " + testDone.score + " / " + testDone.total + ". Можно пройти заново.";
    }

    function render() {
      var q = TEST[idx];
      qEl.textContent = (idx + 1) + ". " + q.q;
      counterEl.textContent = (idx + 1) + " / " + TEST.length;
      fillEl.style.width = (((idx + 1) / TEST.length) * 100) + "%";
      optsEl.innerHTML = "";
      feedbackEl.hidden = true;
      feedbackEl.className = "test__feedback";

      var letters = ["А", "Б", "В", "Г"];
      q.o.forEach(function (text, i) {
        var b = document.createElement("button");
        b.className = "opt";
        b.dataset.i = i;
        b.innerHTML = '<span class="opt__key">' + letters[i] + "</span><span>" + text + "</span>";
        b.addEventListener("click", function () { pick(i); });
        optsEl.appendChild(b);
      });

      if (answers[idx] !== undefined) applyPicked(answers[idx]);

      prevBtn.disabled = idx === 0;
      nextBtn.textContent = idx === TEST.length - 1 ? "Завершить" : "Далее →";
      nextBtn.disabled = answers[idx] === undefined;
    }

    function pick(i) {
      answers[idx] = i;
      applyPicked(i);
      nextBtn.disabled = false;
    }

    function applyPicked(i) {
      var q = TEST[idx];
      $$(".opt", optsEl).forEach(function (b) {
        b.classList.remove("is-picked", "is-correct", "is-wrong");
        if (+b.dataset.i === i) b.classList.add("is-picked");
      });
      var chosen = optsEl.querySelector('.opt[data-i="' + i + '"]');
      var correct = optsEl.querySelector('.opt[data-i="' + q.c + '"]');
      if (i === q.c) {
        chosen.classList.add("is-correct");
        feedbackEl.textContent = "✅ Верно. " + q.exp;
        feedbackEl.className = "test__feedback ok";
      } else {
        chosen.classList.add("is-wrong");
        correct.classList.add("is-correct");
        feedbackEl.textContent = "❌ Неверно. " + q.exp;
        feedbackEl.className = "test__feedback no";
      }
      feedbackEl.hidden = false;
    }

    function finish() {
      var score = 0;
      TEST.forEach(function (q, i) { if (answers[i] === q.c) score++; });
      var total = TEST.length;
      var pct = Math.round((score / total) * 100);

      runBox.hidden = true;
      resultBox.hidden = false;
      scoreEl.textContent = score + " / " + total;

      var verdict;
      if (pct >= 85) verdict = "Хорошо. Правила держатся — на перекрёстке останется увидеть их вживую.";
      else if (pct >= 50) verdict = "Есть пробел. Повторите разделы «Назовите перекрёсток» и «Если права равны: правило правой руки» и пройдите проверку снова.";
      else verdict = "Повторите разделы «Назовите перекрёсток» и «Если права равны: правило правой руки».";
      verdictEl.textContent = verdict;

      listEl.innerHTML = "";
      TEST.forEach(function (q, i) {
        var ok = answers[i] === q.c;
        var li = document.createElement("li");
        li.className = ok ? "ok" : "no";
        li.innerHTML =
          '<span class="rl-q">' + (ok ? "✅" : "❌") + " " + (i + 1) + ". " + q.q + "</span>" +
          '<span class="rl-a">Верный ответ: ' + q.o[q.c] + ". " + q.exp + "</span>";
        listEl.appendChild(li);
      });

      testDone = { score: score, total: total };
      store.set("lastTest", testDone);
      markVisited("test");
      updateProgress();

      resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    nextBtn.addEventListener("click", function () {
      if (idx < TEST.length - 1) { idx++; render(); }
      else finish();
    });
    prevBtn.addEventListener("click", function () {
      if (idx > 0) { idx--; render(); }
    });

    beginBtn.addEventListener("click", function () {
      answers = [];
      idx = 0;
      startBox.hidden = true;
      resultBox.hidden = true;
      runBox.hidden = false;
      render();
      runBox.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    retryBtn.addEventListener("click", function () { beginBtn.click(); });
  })();

  /* ============================================================
     Чек-лист
     ============================================================ */

  (function initChecklist() {
    var box = $("#checklist");
    if (!box) return;
    var saved = store.get("checklist", {});
    var items = $$('input[type="checkbox"]', box);

    items.forEach(function (input) {
      var key = input.dataset.key;
      input.checked = !!saved[key];
      input.addEventListener("change", function () {
        saved[key] = input.checked;
        store.set("checklist", saved);
      });
    });
  })();

  /* ============================================================
     Старт
     ============================================================ */

  /* ============================================================
     Переворачивающаяся карточка
     ============================================================ */

  (function initFlip() {
    $$("[data-flip]").forEach(function (el) {
      var front = el.querySelector(".flip__face--front");
      var back = el.querySelector(".flip__face--back");
      if (!front || !back) return;

      function size() {
        var face = el.classList.contains("is-open") ? back : front;
        el.style.height = face.scrollHeight + "px";
      }

      function toggle() {
        el.classList.toggle("is-open");
        el.setAttribute("aria-expanded", el.classList.contains("is-open") ? "true" : "false");
        size();
      }

      el.addEventListener("click", toggle);
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      $$("img", el).forEach(function (img) {
        if (!img.complete) img.addEventListener("load", size);
      });
      window.addEventListener("resize", size);
      size();
    });
  })();

  initNav();
})();
