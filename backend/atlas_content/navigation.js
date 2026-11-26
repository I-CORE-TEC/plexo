(() => {
  const home = document.getElementById("mapa");
  const chapters = [...document.querySelectorAll(".chapter")];
  const embedded = window.self !== window.top;

  function show(id, focus) {
    const current = chapters.find((chapter) => chapter.id === id);
    home.classList.toggle("hid", Boolean(current));
    chapters.forEach((chapter) => chapter.classList.toggle("hid", chapter !== current));
    const panel = current || home;
    const graph = panel.querySelector(".viewport");
    if (graph) graph.scrollLeft = Math.max(0, (graph.scrollWidth - graph.clientWidth) / 2);
    if (focus) {
      window.scrollTo(0, 0);
      panel.querySelector(current ? "h2" : "h1").focus({ preventScroll: true });
    }
  }

  function navigate(id) {
    if (embedded) show(id, true);
    else location.hash = id;
  }

  const jump = document.getElementById("flow-jump");
  if (jump) jump.addEventListener("change", () => {
    if (jump.value) navigate(jump.value);
    jump.value = "";
  });

  if (embedded) {
    // An opaque sandbox cannot safely navigate its document URL. Follow the
    // same graph without changing the frame's location or relaxing isolation.
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      navigate(link.getAttribute("href").slice(1));
    });
  } else {
    window.addEventListener("hashchange", () => show(location.hash.slice(1), true));
  }
  show(embedded ? "" : location.hash.slice(1), false);
})();