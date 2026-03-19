/**
 * Remark plugin that removes the "## Related Skills" heading and all content
 * after it from skill docs rendered on the site. The site auto-generates a
 * styled SkillCard tile section from skills-meta.ts connections data, so the
 * markdown section would otherwise render twice.
 *
 * The markdown sections are preserved in docs/skills/ for GitHub browsing.
 */
export default function remarkStripRelatedSkills() {
  return function transformer(tree) {
    const children = tree.children;
    const idx = children.findIndex(
      node =>
        node.type === 'heading' &&
        node.depth === 2 &&
        node.children?.[0]?.value === 'Related Skills'
    );
    if (idx !== -1) {
      children.splice(idx);
    }
  };
}
