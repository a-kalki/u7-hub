(function() {
  var svgObj = document.getElementById('roadmap-svg');
  var phaseContent = document.getElementById('phase-content');
  var activeRect = null;
  var activeSub = null;
  var phases = ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6'];

  if (!svgObj || !phaseContent) return;

  function resetActive() {
    if (activeRect) { activeRect.classList.remove('active'); activeRect = null; }
    if (activeSub) { activeSub.classList.remove('active'); activeSub = null; }
  }

  function showPhase(phaseId) {
    var el = document.getElementById('phase-content-' + phaseId);
    if (!el || !el.innerHTML.trim()) return;

    try {
      var svgDoc = svgObj.contentDocument;
      if (svgDoc) {
        resetActive();
        var rect = svgDoc.getElementById(phaseId + '-rect');
        if (rect) { rect.classList.add('active'); activeRect = rect; }
      }
    } catch(e) {}

    phaseContent.innerHTML = el.innerHTML;
    try { sessionStorage.setItem('activePhase', phaseId); } catch(e) {}
  }

  // Клик на модуль: показать этап + проскроллить к модулю
  function showModule(moduleId) {
    var parts = moduleId.split(':');
    var phaseId = parts[0];
    var modAnchor = parts[1];

    showPhase(phaseId);

    // Подсветка модуля в SVG
    try {
      var svgDoc = svgObj.contentDocument;
      if (svgDoc) {
        var sub = svgDoc.querySelector('[data-module="' + moduleId + '"]');
        if (sub) {
          if (activeSub) activeSub.classList.remove('active');
          sub.classList.add('active');
          activeSub = sub;
        }
      }
    } catch(e) {}

    // Скролл к якорю модуля в контенте
    setTimeout(function() {
      var anchor = document.getElementById('module-' + phaseId + '-' + modAnchor);
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function init() {
    try {
      var svgDoc = svgObj.contentDocument;
      if (!svgDoc) return;

      // Клики по этапам
      svgDoc.querySelectorAll('.phase-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
          // Не обрабатываем, если клик был по модулю внутри этапа
          if (e.target.closest('.module-sub')) return;
          var phase = link.getAttribute('data-phase');
          if (phase) showPhase(phase);
        });
      });

      // Клики по модулям
      svgDoc.querySelectorAll('.module-sub').forEach(function(mod) {
        mod.addEventListener('click', function() {
          var moduleId = mod.getAttribute('data-module');
          if (moduleId) showModule(moduleId);
        });
      });

      var saved = null;
      try { saved = sessionStorage.getItem('activePhase'); } catch(e) {}
      showPhase(saved && phases.indexOf(saved) >= 0 ? saved : 'phase1');
    } catch(e) {}
  }

  if (svgObj.contentDocument && svgObj.contentDocument.readyState === 'complete') {
    init();
  } else {
    svgObj.addEventListener('load', init);
  }
})();
