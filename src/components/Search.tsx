import React, { useState, useEffect, useRef, useCallback } from 'react';
import algoliasearch from 'algoliasearch/lite';
import { trackSearchQuery } from '../utils/analytics';

interface SearchProps {
  base: string;
}

interface SearchResult {
  objectID: string;
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
  hierarchy: {
    lvl0: string;
    lvl1: string | null;
    lvl2: string | null;
  };
}

export default function Search({ base }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Algolia client
  const env = (import.meta as any).env;

  // Debug: Check if Algolia env vars are loaded
  if (!env.PUBLIC_ALGOLIA_APP_ID || !env.PUBLIC_ALGOLIA_SEARCH_KEY) {
    console.error('Missing Algolia environment variables:', {
      appId: !!env.PUBLIC_ALGOLIA_APP_ID,
      searchKey: !!env.PUBLIC_ALGOLIA_SEARCH_KEY,
      indexName: !!env.PUBLIC_ALGOLIA_INDEX_NAME,
    });
  }

  const searchClient = algoliasearch(
    env.PUBLIC_ALGOLIA_APP_ID,
    env.PUBLIC_ALGOLIA_SEARCH_KEY
  );
  const index = searchClient.initIndex(env.PUBLIC_ALGOLIA_INDEX_NAME);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const { hits } = await index.search(query, {
          hitsPerPage: 8,
          attributesToRetrieve: [
            'title',
            'description',
            'url',
            'category',
            'tags',
            'hierarchy',
          ],
          attributesToHighlight: ['title', 'description'],
        });

        setResults(hits as SearchResult[]);
        setIsOpen(hits.length > 0);
        setSelectedIndex(-1);

        // Track search query - don't wait for it
        trackSearchQuery(query, hits.length).catch(console.debug);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]); // Remove index from dependencies to prevent re-renders

  // Handle result click with useCallback to stabilize reference
  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      // Track clicked result
      await trackSearchQuery(query, results.length, result.url);

      // Navigate to result
      window.location.href = base + result.url;

      // Close search
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(-1);
    },
    [query, results.length, base]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, handleResultClick]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;

    const regex = new RegExp(
      `(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-lg mx-auto">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search essays..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          className="w-full px-4 py-2 pr-10 text-sm border border-gray-300 rounded-lg 
                     bg-white text-gray-900 placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          aria-label="Search essays"
          aria-haspopup="listbox"
        />

        {/* Search Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {loading ? (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          ) : (
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-auto">
          <ul role="listbox" className="py-1">
            {results.map((result, index) => (
              <li
                key={result.objectID}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <button
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                               ${selectedIndex === index ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                >
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {highlightText(result.title, query)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {highlightText(result.description, query)}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {result.category}
                      </span>
                      {result.tags &&
                        result.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
