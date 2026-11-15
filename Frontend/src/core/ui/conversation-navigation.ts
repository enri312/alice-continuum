/** Enhance the existing navigation; no page state or application data lives here. */
export function bindConversationNavigation(nav: HTMLElement): () => void {
  const previous = nav.querySelector<HTMLButtonElement>(".conversation-nav-scroll.previous");
  const next = nav.querySelector<HTMLButtonElement>(".conversation-nav-scroll.next");
  if (!previous || !next) return () => {};
  const update = () => {
    previous.disabled = nav.scrollLeft <= 1;
    next.disabled = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 1;
  };
  const move = (direction: number) => nav.scrollBy({
    left: direction * Math.max(180, nav.clientWidth * .65),
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
  const back = () => move(-1);
  const forward = () => move(1);
  previous.addEventListener("click", back);
  next.addEventListener("click", forward);
  nav.addEventListener("scroll", update, { passive: true });
  const resize = new ResizeObserver(update);
  resize.observe(nav);
  update();
  return () => {
    resize.disconnect();
    nav.removeEventListener("scroll", update);
    previous.removeEventListener("click", back);
    next.removeEventListener("click", forward);
  };
}
