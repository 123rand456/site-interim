import React from 'react';
import { Rss } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

interface RSSButtonProps {
  variant?: 'nav' | 'icon' | 'full';
  className?: string;
  href?: string;
}

export default function RSSButton({
  variant = 'nav',
  className,
  href = '/rss.xml',
}: RSSButtonProps) {
  const baseProps = {
    asChild: true,
    className: cn(className),
  };

  if (variant === 'icon') {
    return (
      <Button variant="ghost" size="icon" title="RSS Feed" {...baseProps}>
        <a href={href} aria-label="RSS Feed">
          <Rss className="h-4 w-4" />
        </a>
      </Button>
    );
  }

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        size="sm"
        title="Subscribe to RSS Feed"
        {...baseProps}
      >
        <a href={href} className="flex items-center gap-2">
          <Rss className="h-4 w-4" />
          Subscribe
        </a>
      </Button>
    );
  }

  // Default 'nav' variant - minimalist for navigation
  return (
    <Button variant="ghost" size="sm" title="RSS Feed" {...baseProps}>
      <a href={href} className="flex items-center gap-1">
        <Rss className="h-4 w-4" />
        <span className="hidden sm:inline">RSS</span>
      </a>
    </Button>
  );
}
