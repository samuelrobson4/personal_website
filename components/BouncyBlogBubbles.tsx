import React from 'react';
import type { Card } from '../types';
import { audio } from '../web/audio';

type Props = {
  cards: Card[];
  height?: number; // Keep for backward compatibility but won't be used
};

export default function BouncyBlogBubbles({ cards }: Props) {
  const scrollLeft = () => {
    const container = document.querySelector('.blog-bubbles-grid');
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = document.querySelector('.blog-bubbles-grid');
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  return (
    <div className="blog-container" style={{ position: 'relative' }}>
      <div className="blog-bubbles-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '16px',
        padding: '20px',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto'
      }}>
        {cards.map((c) => (
          <div key={c.id} className="blog-bubble-grid" role="link" tabIndex={0} 
               onClick={() => { audio.click(); window.open(c.url, '_blank', 'noopener'); }}
               style={{
                 background: 'rgba(255,255,255,0.9)',
                 borderRadius: '12px',
                 display: 'flex',
                 flexDirection: 'column',
                 alignItems: 'center',
                 justifyContent: 'center',
                 padding: '16px',
                 textAlign: 'center',
                 cursor: 'pointer',
                 transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                 border: '1px solid rgba(0,0,0,0.05)'
               }}
               onMouseEnter={(e) => {
                 (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                 (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
               }}
               onMouseLeave={(e) => {
                 (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                 (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
               }}>
            <div className="blog-bubble-title">{(c.title || '').toLowerCase()}</div>
            {c.subtitle ? <div className="blog-bubble-sub">{c.subtitle}</div> : null}
          </div>
        ))}
      </div>
      <button className="blog-arrow blog-arrow-left" onClick={scrollLeft} aria-label="Scroll left">‹</button>
      <button className="blog-arrow blog-arrow-right" onClick={scrollRight} aria-label="Scroll right">›</button>
    </div>
  );
}


