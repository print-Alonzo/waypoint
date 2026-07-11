Smooth, draggable stop reordering

     Context

     Reordering stops on /result today is instant and jarring. You press ↑/↓ on a card, the browser
     URL is rewritten, and on the next commit the whole list snaps into its new arrangement — cards, stop
     numbers, arrival times, and transit legs all change in one frame with no visual continuity. Nothing
     tells your eye which card moved or where it went, so the core promise of the product ("the day
     stays yours to adjust") feels mechanical rather than direct.

     We're fixing this in two parts:

     1. Motion — every order change animates. The card you moved glides to its new slot; the cards it
     displaces slide to make room; the transit legs re-time with a crossfade. This applies to ↑/↓,
     Re-optimize unpinned, Reset to auto, and browser-back alike.
     2. Drag-and-drop — a grip handle on each card lets you pick a stop up and drop it where you want,
     instead of clicking ↓ four times.

     The ↑/↓ buttons stay exactly as they are. They remain the keyboard and screen-reader path;
     drag is a pointer-only enhancement layered on top.

     ---
     Key architectural facts (read before writing code)

     These three shape every decision below.

     The order is not in React state — it's in the URL. ResultView derives everything from a single
     model memo (web/components/ResultView.tsx:279-405) that reads useSearchParams(), resolves the
     working order: string[], and runs optimizeOrder + scheduleAlong over it. moveStop
     (:619-628) swaps two ids and calls writeArrangement → writeUrl → router.replace(...)
     (:549-579). There is no local array to animate — the list only reorders after Next's router
     round-trips. This is why Step 4 (optimistic order) comes before the drag work: dnd-kit needs an
     items array that updates synchronously on drop, or the list will snap back to the old order for a
     frame before the router catches up.

     The transit connector lives inside each <li>, above the card (:1063-1071), and the first
     stop has no connector. So <li> heights are structurally inconsistent, and if you make the <li> the
     draggable/animated unit, any card entering or leaving position 1 will visibly jump by the connector's
     height (~44px) at the start of its animation. The fix: make the inner card <div> the sortable
     node, and leave the <li> as a plain wrapper. dnd-kit then measures and translates cards, whose
     spacing is uniform (every consecutive card pair is separated by exactly one leg row). The legs
     re-render in place instantly, which we mask with a crossfade (Step 6).

     Two commits land per reorder in production. The static schedule recomputes synchronously in the
     model memo; then the Mapbox road overlay resolves a few hundred ms later for the new order
     (:419-439) and rewrites the arrival times and transit minutes again. Motion must therefore be
     driven off order changes only, never off "the model changed" — otherwise cards will re-animate
     when the road overlay lands. dnd-kit's sortable does this correctly for us because it keys off the
     items array, not off the rendered content.

     ---
     Dependencies

     Verified against the registry: the stable dnd-kit packages declare react: >=16.8.0 with no upper
     bound, so they install cleanly on React 19.2.4 — no --legacy-peer-deps, no overrides.

     cd web
     npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2

     Do not use @dnd-kit/react (the 0.x rewrite) — unstable API. Do not add @dnd-kit/modifiers;
     the one modifier we need is four lines (Step 5).

     ---
     Step 1 — Test environment stubs

     @dnd-kit/core uses ResizeObserver to measure droppables, and jsdom does not implement it. Without
     a stub, every existing ResultView test will throw (result-reorder, result-duration,
     result-budget, result-routing, scheduler-integration). The reduced-motion hook (Step 3) needs
     matchMedia, which older jsdom also lacks.

     In web/vitest.setup.ts, before the afterEach:

     // @dnd-kit/core measures droppables with ResizeObserver; jsdom has no implementation.
     if (!globalThis.ResizeObserver) {
       globalThis.ResizeObserver = class {
         observe() {}
         unobserve() {}
         disconnect() {}
       } as unknown as typeof ResizeObserver
     }

     // usePrefersReducedMotion reads matchMedia; jsdom's support is partial.
     if (!window.matchMedia) {
       window.matchMedia = ((query: string) => ({
         matches: false,
         media: query,
         onchange: null,
         addEventListener() {},
         removeEventListener() {},
         addListener() {},
         removeListener() {},
         dispatchEvent: () => false,
       })) as unknown as typeof window.matchMedia
     }

     Run npm run test right after this step and confirm the suite is still green before touching
     ResultView — that isolates dnd-kit-in-jsdom failures from your own changes.

     ---
     Step 2 — Motion tokens

     The app has no motion tokens and no prefers-reduced-motion support anywhere today (TODOS.md
     already lists a reduced-motion audit as deferred work). Add the tokens the same way every other token
     is defined — CSS variables in web/app/globals.css, consumed via Tailwind arbitrary values. Per
     DESIGN.md: never hardcode values in components.

     In :root:

       /* Motion — list reordering (components/ResultView.tsx) */
       --wp-motion-reorder: 220ms;
       --wp-ease-reorder: cubic-bezier(0.2, 0, 0, 1); /* fast out, gentle settle */

     Then, at the end of the file:

     /* Transit legs re-time on every reorder. Rather than let the new number pop in
        under a card that's still gliding, hold the leg blank for the first half of the
        move and fade it back in with its recomputed value. */
     @keyframes wp-leg-settle {
       0%,
       55% {
         opacity: 0;
       }
       100% {
         opacity: 1;
       }
     }

     @media (prefers-reduced-motion: reduce) {
       :root {
         --wp-motion-reorder: 1ms;
       }
       .wp-leg {
         animation: none !important;
       }
     }

     /* A reorder interrupted by Cmd-P must never print a half-applied transform. */
     @media print {
       .wp-stop {
         transform: none !important;
         transition: none !important;
         box-shadow: none !important;
       }
       .wp-leg {
         animation: none !important;
         opacity: 1 !important;
       }
     }

     ---
     Step 3 — usePrefersReducedMotion

     New file web/lib/use-reduced-motion.ts. useSyncExternalStore (not useEffect + state) so the
     value is correct on first paint and the server snapshot is explicit — SSR must return false or
     React will warn on hydration mismatch.

     'use client'

     import { useSyncExternalStore } from 'react'

     const QUERY = '(prefers-reduced-motion: reduce)'

     function subscribe(onChange: () => void): () => void {
       const mq = window.matchMedia(QUERY)
       mq.addEventListener('change', onChange)
       return () => mq.removeEventListener('change', onChange)
     }

     /** True when the OS asks for reduced motion. Always false during SSR/prerender. */
     export function usePrefersReducedMotion(): boolean {
       return useSyncExternalStore(
         subscribe,
         () => window.matchMedia(QUERY).matches,
         () => false,
       )
     }

     ---
     Step 4 — Optimistic order (do this before any dnd-kit code)

     Today moveStop writes the URL and waits. We need the order to change in the same commit as the
     user's action, so dnd-kit's items array is authoritative the instant a drag ends and the list never
     flashes the old arrangement.

     All changes in web/components/ResultView.tsx.

     a. Add the state, next to the existing roadOverlay state (~`:274`):

     // An order the user just chose that the router hasn't committed to the URL yet.
     // The URL stays the source of truth; this only bridges the async gap so the list
     // (and dnd-kit's `items`) reorder synchronously instead of one router tick later.
     const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

     b. Apply it in the model memo. Inside the memo, the URL-resolved order is computed at
     :312-318. Keep that result as urlOrder, then layer the pending order over it:

     let urlOrder: string[]
     if (params.order && params.order.length) {
       const fromUrl = [...new Set(params.order.filter((id) => validIds.has(id)))]
       urlOrder = [...fromUrl, ...defaultOrder.filter((id) => !fromUrl.includes(id))]
     } else {
       urlOrder = defaultOrder
     }

     // Only honour a pending order that is still a permutation of the SELECTED set —
     // a stale one (the POI set changed under it) is dropped rather than misapplied,
     // the same way a stale road overlay is.
     const pendingValid =
       pendingOrder != null &&
       pendingOrder.length === validIds.size &&
       pendingOrder.every((id) => validIds.has(id))
     const order = pendingValid ? pendingOrder! : urlOrder

     Add urlOrder to the memo's return object, and add pendingOrder to the dependency array
     ([params, roadOverlay, pendingOrder]). Everything downstream — orderPOIs, locked, isOptimal,
     scheduleAlong, the road-routing effect, writeUrl's merge base — already reads model.order, so it
     all follows automatically.

     c. Clear it once the URL catches up, as an effect near the routing effect:

     // Retire the optimistic order the moment the URL resolves to the same thing.
     // Compare against `urlOrder` (the URL's RESOLVED order), not `params.order` —
     // writeUrl omits the `order` param entirely when it equals defaultOrder, so a
     // drag back to the auto order would otherwise leave this pinned forever and
     // override a later browser-back.
     useEffect(() => {
       if (pendingOrder && model && sameOrder(model.urlOrder, pendingOrder)) setPendingOrder(null)
     }, [model, pendingOrder])

     d. Route every order change through one function, replacing the writeArrangement calls in
     moveStop, reOptimize, and resetAuto:

     function applyOrder(nextOrder: string[], nextLocked: string[]) {
       setPendingOrder(nextOrder)
       writeArrangement(nextOrder, nextLocked)
     }

     - moveStop → applyOrder(next, [...model!.locked])
     - reOptimize → applyOrder(opt.order.map((p) => p.id), [...model!.locked])
     - resetAuto → applyOrder(model!.defaultOrder, [])
     - toggleLock keeps calling writeArrangement directly (it doesn't change the order).

     e. Clear the pending order in chooseMode (:605-617). It deliberately drops the custom order
     when you switch transport mode ("the custom order was chosen for the old mode"); without an explicit
     setPendingOrder(null), a pending order would survive the mode switch and silently defeat that.

     ---
     Step 5 — Drag-and-drop + layout animation

     5a. The sortable wrapper

     New file web/components/SortableStop.tsx. It's a render-prop wrapper, not a card extraction —
     this is deliberate. The card JSX in ResultView (:1058-1171) closes over model, fit, params,
     setDuration, wouldOverflowBudget and a dozen other locals; hoisting it into a real component
     means threading ~20 props for no benefit. The wrapper supplies the <li> + the sortable card <div>
     and hands the drag listeners back to the caller for its grip handle.

     'use client'

     import type { ReactNode } from 'react'
     import type { AnimateLayoutChanges, SyntheticListenerMap } from '@dnd-kit/sortable'
     import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
     import { CSS } from '@dnd-kit/utilities'

     type Props = {
       id: string
       cardClassName: string
       reduceMotion: boolean
       children: (drag: { listeners: SyntheticListenerMap | undefined; isDragging: boolean }) => ReactNode
       /** Rendered inside the <li> ABOVE the card — the lunch pill + transit leg. */
       lead?: ReactNode
     }

     export default function SortableStop({ id, cardClassName, reduceMotion, children, lead }: Props) {
       // dnd-kit only animates layout changes that FOLLOW a drag by default. Forcing
       // `wasDragging` makes it FLIP on ANY index change — so the ↑/↓ buttons,
       // Re-optimize, Reset to auto and browser-back all animate through the same path.
       const animateLayoutChanges: AnimateLayoutChanges = (args) =>
         reduceMotion ? false : defaultAnimateLayoutChanges({ ...args, wasDragging: true })

       const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
         id,
         animateLayoutChanges,
         transition: reduceMotion
           ? null
           : { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }, // keep in sync with --wp-motion-reorder
       })

       return (
         <li>
           {lead}
           <div
             ref={setNodeRef}
             {...attributes}
             // The CARD is the sortable node, not the <li> — the <li> also holds the
             // transit leg, whose presence differs at index 0, which would make the
             // FLIP measure a jump. Card-to-card spacing is uniform; li-to-li isn't.
             className={`wp-stop relative ${cardClassName}${isDragging ? ' z-10 shadow-lg' : ''}`}
             style={{
               transform: CSS.Translate.toString(transform), // Translate, not Transform: never scale a card
               transition: transition ?? undefined,
             }}
             data-dragging={isDragging || undefined}
           >
             {children({ listeners, isDragging })}
           </div>
         </li>
       )
     }

     Note {...attributes} is spread on the card for aria-roledescription etc., but listeners go
     only on the grip handle (5c) — so the buttons and the duration stepper inside the card never
     compete with the drag gesture.

     5b. Wire the context in ResultView

     Replace the bare <ol className="mt-5"> (:1045) with:

     <DndContext
       sensors={sensors}
       collisionDetection={closestCenter}
       modifiers={[restrictToVerticalAxis]}
       measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
       onDragStart={() => setDragging(true)}
       onDragEnd={handleDragEnd}
       onDragCancel={() => setDragging(false)}
       accessibility={{ announcements: undefined }}
     >
       <SortableContext items={model.order} strategy={verticalListSortingStrategy}>
         <ol className="mt-5" data-reordering={reordering || undefined}>
           {stops.map((stop, i) => { /* … existing body, now returning <SortableStop> … */ })}
         </ol>
       </SortableContext>
     </DndContext>

     Supporting pieces, all inside ResultView:

     const reduceMotion = usePrefersReducedMotion()

     // Cards change height as the schedule re-times (flag tints, the "Beyond your Nh"
     // pill, the reason line). Measuring only on drag-start would leave dnd-kit with
     // stale rects, so re-measure continuously.
     // ^ this is why MeasuringStrategy.Always above is required, not optional.

     const sensors = useSensors(
       // A short distance threshold, so a tap on the grip that turns into a page
       // scroll doesn't start a drag. The handle sets `touch-action: none`, so
       // PointerSensor covers mouse, pen and touch; no separate TouchSensor needed.
       useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
     )

     restrictToVerticalAxis — write it inline rather than pulling in @dnd-kit/modifiers for one
     function. Define it at module scope:

     // The itinerary is a single column: lock drags to the Y axis.
     const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

     handleDragEnd, alongside moveStop:

     function handleDragEnd(event: DragEndEvent) {
       setDragging(false)
       const { active, over } = event
       if (!over || active.id === over.id) return
       const from = model!.order.indexOf(String(active.id))
       const to = model!.order.indexOf(String(over.id))
       if (from < 0 || to < 0) return

       const next = arrayMove(model!.order, from, to) // from @dnd-kit/sortable
       const name = POI_MAP[String(active.id)]?.name ?? 'Stop'
       setLiveMsg(`Moved ${name} to position ${to + 1}.`) // same announcement moveStop makes
       setAdjustOpen(true) // reveal the now-relevant Re-optimize / Reset controls
       applyOrder(next, [...model!.locked])
     }

     No KeyboardSensor, and accessibility.announcements is left off — both on purpose. The ↑/↓
     buttons are already the keyboard reorder path and they already announce through the existing
     aria-live region via setLiveMsg. Adding dnd-kit's keyboard sensor would give screen-reader users
     two competing reorder mechanisms on the same list and a second, duplicate announcement channel.
     Leave a comment in the code saying so, or a future reader will "fix" it.

     Do not use <DragOverlay>. It renders a floating clone, which would mean duplicating the entire
     card JSX. Translating the card in place gives the same result here (nothing in the ancestor chain
     clips overflow) for a fraction of the code.

     5c. The grip handle

     Inside the card's existing header row (:1076, the flex items-start justify-between div), add the
     grip as the first child, before the flag glyph / stop number:

     <button
       type="button"
       {...listeners}
       // Pointer-only affordance: the ↑ ↓ buttons in this same card are the keyboard
       // and screen-reader path, so exposing this as a third focusable control would
       // just add noise. touch-action:none is scoped to these 44px so the rest of the
       // card still scrolls the page normally on touch.
       aria-hidden="true"
       tabIndex={-1}
       className={`no-print flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-md
         text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-subtle)]
         ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
     >
       <GripIcon />
     </button>

     GripIcon — a small 6-dot SVG, defined beside LockIcon (:88-105) and following its conventions
     (viewBox="0 0 24 24", width/height={14}, currentColor, aria-hidden="true").

     Everything else in the card body stays byte-for-byte identical. The existing lunch pill and transit
     connector (:1060-1071) move into SortableStop's lead prop unchanged.

     ---
     Step 6 — Settle polish

     Two touches that make the motion legible rather than just present.

     Leg crossfade. The transit legs and lunch pill re-render with new values the instant the order
     changes, while the cards are still in flight — so a card glides over a leg showing a number that
     just changed. Fade them instead. Add wp-leg to the connector and lunch-pill wrappers, and drive the
     keyframe from Step 2 off a flag on the <ol>:

     const [reordering, setReordering] = useState(false)

     Set it in applyOrder (so it covers buttons, drag, Re-optimize and Reset in one place) and clear it
     on a timer:

     function applyOrder(nextOrder: string[], nextLocked: string[]) {
       setPendingOrder(nextOrder)
       if (!reduceMotion) {
         setReordering(true)
         if (settleTimer.current) clearTimeout(settleTimer.current)
         settleTimer.current = setTimeout(() => setReordering(false), 260)
       }
       writeArrangement(nextOrder, nextLocked)
     }

     Store settleTimer in a useRef and clear it in the existing unmount cleanup effect (:445-456),
     which already does exactly this for copyTimer — follow that pattern, including the mounted guard.

     ol[data-reordering] .wp-leg {
       animation: wp-leg-settle var(--wp-motion-reorder) var(--wp-ease-reorder);
     }

     (A second reorder fired inside the 260ms window won't restart the CSS animation. The leg is already
     mid-fade at that point, so it reads fine — not worth the key-churn to fix.)

     Just-moved highlight. After a drop or a button move, briefly ring the card that moved so the eye
     can follow it. Track lastMovedId in state (set it in moveStop and handleDragEnd, clear it on the
     same 260ms timer), pass it into SortableStop, and add a ring-1 ring-[var(--color-primary)] while
     set. Skip entirely under reduceMotion.

     ---
     Step 7 — Docs

     - web/DESIGN.md — add a ## Motion section (after ## Shape & elevation, before
     ## Component patterns) documenting --wp-motion-reorder / --wp-ease-reorder, the FLIP-on-any-
     order-change rule, and the prefers-reduced-motion contract. Then update the existing
     Reorder & pin (lock) bullet (~line 143) — it currently describes ↑ ↓ + pin only — to cover the
     drag handle, why it's pointer-only, and that the card (not the <li>) is the sortable node.
     - TODOS.md — the deferred "prefers-reduced-motion audit" item is now partly addressed
     (tokens + hook + the reorder path). Narrow it to what's left: the swipe deck and hover states.
     - web/README.md — add dnd-kit to the stack/dependency list if one is enumerated there.

     ---
     Step 8 — Tests

     web/result-reorder.test.tsx is the model to follow: next/navigation is mocked with vi.hoisted
     spies plus a mutable nav.search, and visual order is read back from the DOM order of the
     Move … later buttons via renderedNames(). Reuse that harness.

     Existing tests must keep passing unchanged. They assert on the URL handed to router.replace, not
     on post-click DOM order, so the optimistic order doesn't invalidate them. But note the behaviour
     change: nav.replace is a spy that never writes back to nav.search, so pendingOrder will now
     persist for the life of the test and the list will re-render in the new order right after a click.
     That's more correct, not less — just don't be surprised by it.

     Add web/result-drag-reorder.test.tsx:

     1. Optimistic order applies synchronously — click Move X later, and renderedNames() reflects
     the swap without setting nav.search and re-rendering. This is the regression test for the
     whole Step 4 mechanism.
     2. A stale pending order is ignored — set a pending order, then change nav.search to a
     different poi_ids set and re-render; the list must follow the URL, not the stale order.
     3. The pending order retires when the URL catches up — apply the URL that router.replace was
     called with, re-render, and confirm the order is stable (no flicker back, no double-apply).
     4. Reset to auto still clears order + locked through the new applyOrder path.
     5. The grip handle is not in the a11y tree — screen.queryAllByRole('button', { name: /drag/i })
     is empty, and the Move … earlier / Move … later / Pin … buttons are all still exposed.

     Do not try to simulate a real drag in jsdom. dnd-kit needs live pointer events and non-zero
     getBoundingClientRects, and mocking both produces a brittle test that verifies the mock. The drag
     gesture is verified in the browser (below); the consequences of a drop are just arrayMove +
     applyOrder, both covered above.

     ---
     Files touched

     ┌─────────────────────────────────────┬────────────────────────────────────────────────────────────────────┐
     │                File                 │                               Change                               │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/package.json                    │ + 3 dnd-kit deps                                                   │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/vitest.setup.ts                 │ ResizeObserver + matchMedia stubs                                  │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/app/globals.css                 │ motion tokens, leg keyframes, reduced-motion + print guards        │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/lib/use-reduced-motion.ts       │ new — usePrefersReducedMotion                                      │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/components/SortableStop.tsx     │ new — render-prop sortable wrapper                                 │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/components/ResultView.tsx       │ pendingOrder + applyOrder, DndContext/SortableContext, grip        │
     │                                     │ handle, GripIcon, settle state                                     │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/result-drag-reorder.test.tsx    │ new                                                                │
     ├─────────────────────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ web/DESIGN.md, TODOS.md,            │ docs                                                               │
     │ web/README.md                       │                                                                    │
     └─────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘

     ---
     Verification

     cd web
     npm run test    # green, including the 5 existing ResultView suites
     npm run build   # also type-checks
     npm run lint

     Then drive it for real — npm run dev, open a 4+ stop plan on /result:

     1. Drag a middle stop to the top. The card follows the pointer, the others slide to make room,
     and on drop the arrival times, stop numbers, transit legs, and the map all re-derive. The URL's
     order param reflects the new arrangement and survives a refresh.
     2. Press ↑/↓ — the card glides instead of snapping. Confirm the card entering position 1 does
     not jump vertically at animation start (that's the bug the card-as-sortable-node design exists
     to prevent; if you see it, setNodeRef is on the wrong element).
     3. Re-optimize unpinned / Reset to auto on a hand-arranged plan — many cards permute at once
     and all of them animate.
     4. Pin a stop, then drag another past it. Pinning is unaffected by drag; the pin must still hold
     its slot under Re-optimize.
     5. Keyboard only. Tab through a card: you reach ↑, ↓, pin, and the duration stepper — and
     never the grip. Reordering by keyboard still announces "Moved X to position N."
     6. Touch (device toolbar or a real phone): drag from the grip works; a swipe anywhere else on
     the card still scrolls the page.
     7. Reduced motion (DevTools → Rendering → Emulate prefers-reduced-motion): reorders apply
     instantly, no glide, no leg fade — and drag still works.
     8. Print preview (Cmd-P) mid-reorder: no stray transform, no shadow, legs fully opaque, grip
     handles absent.
     9. With NEXT_PUBLIC_MAPBOX_TOKEN set, reorder and wait. When the road overlay resolves a few
     hundred ms later, times update but nothing re-animates — that's the two-commit trap.