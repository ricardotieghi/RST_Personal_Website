/**
 * Filter pills, shared by the publications and talks sections.
 *
 * Markup contract:
 *   <div data-filter-group="pubs">
 *     <button data-filter-value="all" aria-pressed="true">All</button>
 *     <button data-filter-value="policy">Policy</button>
 *   </div>
 *   <div data-filter-items="pubs">
 *     <div data-filter-block>            <!-- optional: hides when empty -->
 *       <article data-tags="policy ml">…</article>
 *     </div>
 *   </div>
 *   <p data-filter-status="pubs"></p>    <!-- optional live region -->
 *   <p data-filter-empty="pubs" hidden>  <!-- optional empty state -->
 *
 * A group may carry data-filter-mode="and" to require every active value;
 * the default is "or". Only the talks group uses multiple simultaneous
 * dimensions, so it opts into "and".
 */

type Group = {
  root: HTMLElement;
  buttons: HTMLButtonElement[];
  items: HTMLElement[];
  blocks: HTMLElement[];
  status: HTMLElement | null;
  empty: HTMLElement | null;
  mode: 'and' | 'or';
  /** dimension -> active value, for "and" mode */
  active: Map<string, string>;
};

function tagsOf(el: HTMLElement): string[] {
  return (el.dataset.tags ?? '').split(/\s+/).filter(Boolean);
}

function apply(group: Group) {
  let visible = 0;

  for (const item of group.items) {
    const tags = tagsOf(item);
    let show: boolean;

    if (group.mode === 'and') {
      show = [...group.active.values()].every((v) => v === 'all' || tags.includes(v));
    } else {
      const value = group.active.get('default') ?? 'all';
      show = value === 'all' || tags.includes(value);
    }

    item.toggleAttribute('hidden', !show);
    if (show) visible++;
  }

  // Hide a block (e.g. the "Under review" heading) once it has no visible rows.
  for (const block of group.blocks) {
    const hasVisible = [...block.querySelectorAll<HTMLElement>('[data-tags]')].some(
      (el) => !el.hasAttribute('hidden')
    );
    block.toggleAttribute('hidden', !hasVisible);
  }

  group.empty?.toggleAttribute('hidden', visible > 0);

  // Mark the first and last visible rows so a timeline connector can stop at a
  // dot rather than dangling past whatever the filter removed.
  const shown = group.items.filter((el) => !el.hasAttribute('hidden'));
  for (const item of group.items) {
    item.removeAttribute('data-edge-first');
    item.removeAttribute('data-edge-last');
  }
  shown.at(0)?.setAttribute('data-edge-first', '');
  shown.at(-1)?.setAttribute('data-edge-last', '');

  if (group.status) {
    const total = group.items.length;
    group.status.textContent =
      visible === total ? `Showing all ${total}` : `Showing ${visible} of ${total}`;
  }
}

document.querySelectorAll<HTMLElement>('[data-filter-group]').forEach((root) => {
  const name = root.dataset.filterGroup!;
  const container = document.querySelector<HTMLElement>(`[data-filter-items="${name}"]`);
  if (!container) return;

  const group: Group = {
    root,
    buttons: [...root.querySelectorAll<HTMLButtonElement>('[data-filter-value]')],
    items: [...container.querySelectorAll<HTMLElement>('[data-tags]')],
    blocks: [...container.querySelectorAll<HTMLElement>('[data-filter-block]')],
    status: document.querySelector(`[data-filter-status="${name}"]`),
    empty: document.querySelector(`[data-filter-empty="${name}"]`),
    mode: root.dataset.filterMode === 'and' ? 'and' : 'or',
    active: new Map(),
  };

  // Seed each dimension with whatever button starts pressed.
  for (const button of group.buttons) {
    const dimension = group.mode === 'and' ? button.dataset.filterDim ?? 'default' : 'default';
    if (button.getAttribute('aria-pressed') === 'true') {
      group.active.set(dimension, button.dataset.filterValue!);
    } else if (!group.active.has(dimension)) {
      group.active.set(dimension, 'all');
    }
  }

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-filter-value]'
    );
    if (!button || !root.contains(button)) return;

    const dimension = group.mode === 'and' ? button.dataset.filterDim ?? 'default' : 'default';
    group.active.set(dimension, button.dataset.filterValue!);

    for (const other of group.buttons) {
      const otherDim =
        group.mode === 'and' ? other.dataset.filterDim ?? 'default' : 'default';
      if (otherDim === dimension) {
        other.setAttribute('aria-pressed', String(other === button));
      }
    }

    apply(group);
  });

  apply(group);
});
