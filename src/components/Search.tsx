import React, { useEffect, useRef, useState } from 'react';
import algoliasearch from 'algoliasearch/lite';
import instantsearch from 'instantsearch.js';
import { searchBox, hits } from 'instantsearch.js/es/widgets';

// TypeScript interfaces
interface SearchHit {
  objectID: string;
  title: string;
  description: string;
  slug: string;
  content?: string;
}

interface SearchProps {
  base?: string;
}

const searchClient = algoliasearch(
  (import.meta as any).env.PUBLIC_ALGOLIA_APP_ID,
  (import.meta as any).env.PUBLIC_ALGOLIA_SEARCH_KEY
);

const indexName = (import.meta as any).env.PUBLIC_ALGOLIA_INDEX_NAME;

const Search: React.FC<SearchProps> = ({ base = '/' }) => {
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    if (!searchBoxRef.current || !hitsRef.current) return;

    const search = instantsearch({
      indexName,
      searchClient,
      insights: false,
    });

    search.addWidgets([
      searchBox({
        container: searchBoxRef.current,
        placeholder: 'Search essays...',
        showReset: false,
        showSubmit: false,
        cssClasses: {
          input: 'ais-SearchBox-input',
        },
        queryHook: (inputValue: string, searchFn: (query: string) => void) => {
          setQuery(inputValue);
          searchFn(inputValue);
        },
      }),
      hits({
        container: hitsRef.current,
        templates: {
          item: (hit: SearchHit) => `
            <a href="${base}essays/${hit.slug}" 
               style="display:block;text-decoration:none;color:inherit;" 
               onmousedown="window.location=this.href">
              <div>
                <div style="font-weight:bold;">${hit.title}</div>
                <div style="font-size:0.95em;color:#555;">${hit.description}</div>
              </div>
            </a>
          `,
        },
      }),
    ]);

    search.start();

    // Show/hide dropdown on focus/blur
    const input = searchBoxRef.current.querySelector('input');
    if (input) {
      const handleFocus = () => setIsFocused(true);
      const handleBlur = () => setIsFocused(false);

      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);

      // Cleanup function
      return () => {
        search.dispose();
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      };
    }

    return () => {
      search.dispose();
    };
  }, [base]);

  // Custom clear handler
  const handleClear = (): void => {
    const input = searchBoxRef.current?.querySelector('input');
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setQuery('');
      input.focus();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 20,
        minWidth: 250,
        maxWidth: 350,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div ref={searchBoxRef} />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              zIndex: 2,
            }}
          >
            {/* SVG cross icon */}
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M6 6l8 8M14 6l-8 8"
                stroke="#888"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={hitsRef}
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 0.5rem 0.5rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          position: 'absolute',
          width: '100%',
          maxHeight: 300,
          overflowY: 'auto',
          marginTop: -4,
          display: isFocused ? 'block' : 'none',
        }}
        className="algolia-hits-dropdown"
      />
      <style>{`
        .ais-SearchBox-input {
          width: 100%;
          padding: 0.5rem 2.5rem 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 1rem;
          background: #fff;
          color: #222;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          outline: none;
          transition: border 0.2s;
        }
        .ais-SearchBox-input:focus {
          border-color: #2563eb;
        }
        .algolia-hits-dropdown .ais-Hits-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.15s;
        }
        .algolia-hits-dropdown .ais-Hits-item:last-child {
          border-bottom: none;
        }
        .algolia-hits-dropdown .ais-Hits-item:hover {
          background: #f3f4f6;
        }
        .ais-SearchBox-input::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Search;
