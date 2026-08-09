import React from 'react';
import {Img, staticFile} from 'remotion';
import {APP_ICON, FONT, VIEWPORT} from '../theme';

const TAB_STRIP = 44;
const TOOLBAR = 52;

/** Height of the page area inside the frame — what scenes get to draw in. */
export const PAGE_HEIGHT = VIEWPORT.height - TAB_STRIP - TOOLBAR;

const chrome = {
  strip: '#dee1e6',
  toolbar: '#ffffff',
  tab: '#ffffff',
  omnibox: '#f1f3f4',
  icon: '#5f6368',
  text: '#202124',
  muted: '#5f6368',
};

const Stroke: React.FC<{d: string; size?: number}> = ({d, size = 16}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={chrome.icon}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

/**
 * A Chrome window at 1:1 pixels: tab strip, toolbar with the Puchne icon
 * pinned, and a page area the scenes fill.
 */
export const BrowserFrame: React.FC<{
  tabTitle: string;
  url: string;
  /** Optional favicon for the active tab; falls back to a neutral square. */
  favicon?: string;
  children?: React.ReactNode;
  /** Lifts the Puchne toolbar icon (used when the shortcut fires). */
  iconHighlight?: number;
}> = ({tabTitle, url, favicon, children, iconHighlight = 0}) => {
  const [domain, ...rest] = url.split('/');
  const path = rest.length ? `/${rest.join('/')}` : '';

  return (
    <div
      style={{
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        background: chrome.strip,
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}
    >
      {/* ── Tab strip ──────────────────────────────────────── */}
      <div
        style={{
          height: TAB_STRIP,
          display: 'flex',
          alignItems: 'flex-end',
          paddingLeft: 8,
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 36,
            padding: '0 12px',
            minWidth: 300,
            background: chrome.tab,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
        >
          {favicon ? (
            <Img src={staticFile(favicon)} style={{width: 16, height: 16}} />
          ) : (
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: '#4285f4',
              }}
            />
          )}
          <span style={{fontSize: 13, color: chrome.text, whiteSpace: 'nowrap'}}>
            {tabTitle}
          </span>
          <span style={{marginLeft: 'auto', color: chrome.muted, fontSize: 15}}>
            ×
          </span>
        </div>
        <span
          style={{
            color: chrome.icon,
            fontSize: 19,
            paddingBottom: 8,
            paddingLeft: 4,
          }}
        >
          +
        </span>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            paddingRight: 20,
            paddingBottom: 10,
            color: chrome.icon,
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          <span>—</span>
          <span style={{fontSize: 11}}>◻</span>
          <span>✕</span>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div
        style={{
          height: TOOLBAR,
          background: chrome.toolbar,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 16px',
        }}
      >
        <Stroke d="M19 12H5M12 19l-7-7 7-7" size={18} />
        <span style={{opacity: 0.35}}>
          <Stroke d="M5 12h14M12 5l7 7-7 7" size={18} />
        </span>
        <Stroke d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10" size={17} />
        <div
          style={{
            flex: 1,
            height: 34,
            background: chrome.omnibox,
            borderRadius: 17,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            marginLeft: 6,
          }}
        >
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke={chrome.muted}
            strokeWidth={2.2}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{fontSize: 14, color: chrome.text}}>
            {domain}
            <span style={{color: chrome.muted}}>{path}</span>
          </span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <Stroke d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          <Stroke d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.6 2.6 0 0 1 0 5.2H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.6 2.6 0 0 1 5.2 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z" />
          {/* Puchne, pinned to the toolbar. */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background:
                iconHighlight > 0
                  ? `rgba(251, 146, 60, ${0.22 * iconHighlight})`
                  : 'transparent',
              transform: `scale(${1 + 0.12 * iconHighlight})`,
            }}
          >
            <Img src={staticFile(APP_ICON)} style={{width: 19, height: 19}} />
          </div>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#a8c7fa',
              color: '#062e6f',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            A
          </div>
          <span style={{color: chrome.icon, fontSize: 15, letterSpacing: -1}}>
            ⋮
          </span>
        </div>
      </div>

      {/* ── Page ───────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {children}
      </div>
    </div>
  );
};
