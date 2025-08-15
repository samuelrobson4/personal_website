// Draggable and clickable project cards with pointer events
(function () {
  const container = document.querySelector('.projects-container');
  const cards = Array.from(document.querySelectorAll('.project-card'));
  if (!container || cards.length === 0) return;

  const containerRect = () => container.getBoundingClientRect();

  function resolveCollisions(activeCard) {
    const activeRect = activeCard.getBoundingClientRect();
    const cRect = containerRect();
    cards.forEach((other) => {
      if (other === activeCard) return;
      const r = other.getBoundingClientRect();
      const overlapX = Math.max(0, Math.min(activeRect.right, r.right) - Math.max(activeRect.left, r.left));
      const overlapY = Math.max(0, Math.min(activeRect.bottom, r.bottom) - Math.max(activeRect.top, r.top));
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          const push = overlapX / 2 + 1;
          const direction = activeRect.left < r.left ? 1 : -1;
          const currentLeft = parseFloat(other.style.left || (r.left - cRect.left)) + direction * push;
          other.style.left = Math.max(0, Math.min(currentLeft, cRect.width - r.width)) + 'px';
        } else {
          const push = overlapY / 2 + 1;
          const direction = activeRect.top < r.top ? 1 : -1;
          const currentTop = parseFloat(other.style.top || (r.top - cRect.top)) + direction * push;
          other.style.top = Math.max(0, Math.min(currentTop, cRect.height - r.height)) + 'px';
        }
      }
    });
  }

  function checkCardTouches() {
    // Remove all touching classes first
    cards.forEach(card => card.classList.remove('touching'));
    
    // Check for overlaps and add touching class
    cards.forEach((card1, index1) => {
      const rect1 = card1.getBoundingClientRect();
      cards.forEach((card2, index2) => {
        if (index1 === index2) return;
        const rect2 = card2.getBoundingClientRect();
        
        const overlapX = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
        const overlapY = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
        
        if (overlapX > 10 && overlapY > 10) { // Minimum overlap threshold
          card1.classList.add('touching');
          card2.classList.add('touching');
        }
      });
    });
  }

  cards.forEach((card) => {
    let isPointerDown = false;
    let isDragging = false;
    let startLeft = 0;
    let startTop = 0;
    let offsetX = 0;
    let offsetY = 0;

    const beginDrag = (e) => {
      isDragging = true;
      card.classList.add('dragging');
      const rect = card.getBoundingClientRect();
      const cRect = containerRect();
      startLeft = rect.left - cRect.left + container.scrollLeft;
      startTop = rect.top - cRect.top + container.scrollTop;
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    };

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      isPointerDown = true;
      card.setPointerCapture?.(e.pointerId);
      beginDrag(e);
    };

    const onPointerMove = (e) => {
      if (!isPointerDown || !isDragging) return;
      const nextLeft = e.clientX - containerRect().left - offsetX + container.scrollLeft;
      const nextTop = e.clientY - containerRect().top - offsetY + container.scrollTop;

      const cRect = containerRect();
      const cardRect = card.getBoundingClientRect();
      const width = cardRect.width;
      const height = cardRect.height;
      const maxLeft = cRect.width - width;
      const maxTop = cRect.height - height;

      const clampedLeft = Math.min(Math.max(0, nextLeft), Math.max(0, maxLeft));
      const clampedTop = Math.min(Math.max(0, nextTop), Math.max(0, maxTop));

      // Smooth movement: translate relative to starting left/top
      card.style.transform = `translate3d(${clampedLeft - startLeft}px, ${clampedTop - startTop}px, 0)`;
      card.style.right = 'auto';
      card.style.bottom = 'auto';

      resolveCollisions(card);
      checkCardTouches();
    };

    const onPointerUp = () => {
      if (!isPointerDown) return;
      const wasDragging = isDragging;
      isPointerDown = false;
      isDragging = false;
      card.classList.remove('dragging');

      // Commit transform to left/top for final position
      const computed = getComputedStyle(card);
      const matrix = new DOMMatrixReadOnly(computed.transform);
      if (matrix.m41 !== 0 || matrix.m42 !== 0) {
        const left = (parseFloat(card.style.left || startLeft) + matrix.m41);
        const top = (parseFloat(card.style.top || startTop) + matrix.m42);
        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.style.transform = 'translate3d(0,0,0)';
      }

      checkCardTouches();
      
      if (!wasDragging) {
        const slug = card.getAttribute('data-slug');
        if (slug) window.location.href = 'projects/' + slug + '.html';
      }
    };

    // Keyboard accessibility: Enter/Space to open
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const slug = card.getAttribute('data-slug');
        if (slug) window.location.href = 'projects/' + slug + '.html';
      }
    };

    card.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    card.addEventListener('keydown', onKeyDown);
  });
})();


