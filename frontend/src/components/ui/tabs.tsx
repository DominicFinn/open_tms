import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ onValueChange, value, defaultValue, ...props }, forwardedRef) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement) => {
      rootRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // Radix invokes onValueChange on every active-tab change whether Tabs is
  // controlled (value) or uncontrolled (defaultValue), so mirroring it into
  // local state gives one signal to key the realignment effect off in both
  // cases, without taking over ownership of the value itself.
  const [activeValue, setActiveValue] = React.useState(value ?? defaultValue);
  const isFirstRender = React.useRef(true);
  const pendingRealignRef = React.useRef(false);
  // Holds whatever needs to run to fully resolve the IN-FLIGHT transition
  // (cancel its poll loop, drop its scrollend listener, clear its fallback
  // timer, release its pin) — not just React's unmount cleanup. A fast
  // second click, while the first switch's smooth scroll is still animating,
  // must be able to force that resolution synchronously; otherwise the new
  // pin below captures the still-inflated height from the unfinished one,
  // and every measurement after that is corrupted.
  const settleInFlightRef = React.useRef<() => void>(() => {});

  const handleValueChange = React.useCallback(
    (next: string) => {
      settleInFlightRef.current();

      // BUSINESS RULE: tab panels vary wildly in height (e.g. a shipment's
      // Details tab with its map vs. a one-line Financials tab), and the
      // content ABOVE the tab list (a persistent map/header) can itself be
      // tall enough to push a short panel's content mostly below the fold.
      // Every switch needs a fresh look at whether the new panel fits where
      // the viewport currently is — the direction depends on the specific
      // panel, not on which way the user happened to be scrolled before:
      // sometimes the fix is scrolling up (list scrolled past, out of view),
      // sometimes down (list in view but its content runs off the bottom).
      // Always pin here and let the layout effect below decide the target;
      // it no-ops cheaply if the current position already fits.
      const root = rootRef.current;
      pendingRealignRef.current = true;
      if (root) {
        // Pin the outgoing panel's height so React's DOM swap can't shrink
        // the document out from under the current scroll position. Without
        // this, the browser clamps scrollY to fit the new, shorter document
        // as part of the same layout pass that mounts the new panel — an
        // instant, unanimated snap that happens before any of our JS runs,
        // which is what actually reads as "jarring": not just landing
        // somewhere unrelated, but landing there with no visible transition.
        // Holding the height steady here is what leaves something to
        // animate once we know where we're actually going.
        root.style.minHeight = `${root.getBoundingClientRect().height}px`;
      }
      setActiveValue(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const root = rootRef.current;
    if (!pendingRealignRef.current || !root) return;
    pendingRealignRef.current = false;

    // Radix's TabsContent unmounts the outgoing panel and reveals the
    // incoming one through its own Presence component, which dispatches its
    // enter/exit state from INSIDE a layout effect — that dispatch triggers
    // a further render+commit that neither a layout effect nor a regular
    // effect of ours can observe, because it hasn't happened yet by the time
    // either of ours runs in the same pass. With twelve-odd sibling panels
    // each running their own Presence instance, this can take a couple of
    // those cascaded renders to fully settle, not just one — so rather than
    // guess a fixed delay, poll a couple of short ticks apart until the
    // panel's natural height stops changing, then treat that as settled.
    let settled = false;
    let attempts = 0;
    let lastHeight = -1;
    let pollTimer: number | undefined;
    let fallbackTimer: number | undefined;
    let releasePin: (() => void) | undefined;

    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(fallbackTimer);
      if (releasePin) window.removeEventListener('scrollend', releasePin);
      root.style.minHeight = '';
    };
    settleInFlightRef.current = settle;

    const poll = () => {
      const list = root.querySelector<HTMLElement>('[role="tablist"]');
      if (!list) {
        settle();
        return;
      }

      // Measure the new panel's natural (unpinned) height, then restore the
      // SAME pin handleValueChange set (the old panel's height). Re-measuring
      // root instead of restoring the saved pin value would just capture the
      // new panel's own (already-settled) height, making the "pin" a no-op —
      // there'd be nothing left open to animate into.
      const pinnedHeight = root.style.minHeight;
      root.style.minHeight = '';
      const naturalDocHeight = document.body.scrollHeight;
      root.style.minHeight = pinnedHeight;

      attempts += 1;
      if (naturalDocHeight !== lastHeight && attempts < 10) {
        lastHeight = naturalDocHeight;
        pollTimer = window.setTimeout(poll, 20);
        return;
      }

      const scrollMarginTop = parseFloat(getComputedStyle(list).scrollMarginTop) || 0;
      const idealTop = list.getBoundingClientRect().top + window.scrollY - scrollMarginTop;
      const maxScroll = Math.max(0, naturalDocHeight - window.innerHeight);
      // Landing at the smaller of the two is what makes this work in both
      // directions: when the panel is short, idealTop overshoots what the
      // document can scroll to, so this settles for maxScroll — showing the
      // whole panel instead of stopping short of it. When the panel is tall,
      // maxScroll comfortably exceeds idealTop, so this settles for pinning
      // the tab list to the top instead of scrolling further than needed.
      const target = Math.min(idealTop, maxScroll);

      if (Math.abs(target - window.scrollY) < 2) {
        settle();
        return;
      }

      releasePin = settle;
      window.addEventListener('scrollend', releasePin, { once: true });
      fallbackTimer = window.setTimeout(settle, 700);
      window.scrollTo({ top: target, behavior: 'smooth' });
    };
    pollTimer = window.setTimeout(poll, 0);

    return settle;
  }, [activeValue]);

  return (
    <TabsPrimitive.Root
      ref={setRefs}
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      {...props}
    />
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'scroll-mt-20 inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
