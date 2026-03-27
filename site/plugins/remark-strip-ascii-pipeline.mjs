/**
 * Remark plugin that removes the large ASCII pipeline code block from the
 * "How the Pipeline Works" section in ship-sdlc.md. The site renders a
 * visual ShipPipelineViz component instead. The ASCII block is preserved
 * in the markdown source for GitHub browsing.
 *
 * Matches: a fenced code block that immediately follows the
 * "## How the Pipeline Works" heading (with one paragraph in between)
 * and contains "/ship-sdlc" in its content.
 */
export default function remarkStripAsciiPipeline() {
  return function transformer(tree) {
    const children = tree.children;
    // Find the "How the Pipeline Works" heading
    const headingIdx = children.findIndex(
      node =>
        node.type === 'heading' &&
        node.depth === 2 &&
        node.children?.[0]?.value?.includes('How the Pipeline Works')
    );
    if (headingIdx === -1) return;

    // Look for the first code block after this heading (within the next few nodes)
    for (let i = headingIdx + 1; i < Math.min(headingIdx + 4, children.length); i++) {
      const node = children[i];
      if (node.type === 'code' && node.value?.includes('/ship-sdlc')) {
        children.splice(i, 1);
        return;
      }
    }
  };
}
