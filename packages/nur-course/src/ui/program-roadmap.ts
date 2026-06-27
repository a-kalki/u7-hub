(function() {
  var svgObj = document.getElementById('roadmap-svg');
  var phaseContent = document.getElementById('phase-content');
  var activeRect = null;
  var phases = ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6'];

  if (!svgObj || !phaseContent) return;

  function resetActive() {
    if (activeRect) {
      activeRect.classList.remove('active');
      activeRect = null;
    }
  }

  function showPhase(phaseId) {
    var el = document.getElementById('phase-content-' + phaseId);
    if (!el || !el.innerHTML.trim()) return;

    try {
      var svgDoc = svgObj.contentDocument;
      if (svgDoc) {
        resetActive();
        var rect = svgDoc.getElementById(phaseId + '-rect');
        if (rect) {
          rect.classList.add('active');
          activeRect = rect;
        }
      }
    } catch(e) {}

    phaseContent.innerHTML = el.innerHTML;
    try { sessionStorage.setItem('activePhase', phaseId); } catch(e) {}
  }

  function init() {
    try {
      var svgDoc = svgObj.contentDocument;
      if (!svgDoc) return;
      var links = svgDoc.querySelectorAll('.phase-link');
      links.forEach(function(link) {
        link.addEventListener('click', function() {
          var phase = link.getAttribute('data-phase');
          if (phase) showPhase(phase);
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
