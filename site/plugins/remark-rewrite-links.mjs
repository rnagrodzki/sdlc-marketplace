const docRoutes = {
  'architecture.md': '/sdlc-marketplace/architecture/',
  'getting-started.md': '/sdlc-marketplace/getting-started/',
  'adding-skills.md': '/sdlc-marketplace/guides/adding-skills/',
  'adding-hooks.md': '/sdlc-marketplace/guides/adding-hooks/',
  'plugin-installation.md': '/sdlc-marketplace/guides/plugin-installation/',
  'openspec-overview.md': '/sdlc-marketplace/openspec/overview/',
  'openspec-integration.md': '/sdlc-marketplace/openspec/integration/',
  'openspec-sdlc-handover.md': '/sdlc-marketplace/openspec/handover/',
};

function visitLinks(node, fn) {
  if (node.type === 'link') fn(node);
  if (node.children) node.children.forEach(child => visitLinks(child, fn));
}

export default function remarkRewriteLinks() {
  return function transformer(tree) {
    visitLinks(tree, (node) => {
      const url = node.url;

      // Skip external URLs and absolute paths
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return;
      }

      // Only process .md links (with optional #anchor)
      const mdMatch = url.match(/^(.*\.md)(#.*)?$/);
      if (!mdMatch) return;

      const [, mdPath, anchor = ''] = mdMatch;

      // Handle ../README.md
      if (mdPath === '../README.md') {
        node.url = 'https://github.com/rnagrodzki/sdlc-marketplace/blob/main/README.md' + anchor;
        return;
      }

      // Handle skills/<slug>.md (prefixed)
      const skillsPrefixMatch = mdPath.match(/^skills\/(.+)\.md$/);
      if (skillsPrefixMatch) {
        node.url = `/sdlc-marketplace/skills/${skillsPrefixMatch[1]}/` + anchor;
        return;
      }

      // Handle doc routes lookup (basename only)
      if (Object.prototype.hasOwnProperty.call(docRoutes, mdPath)) {
        node.url = docRoutes[mdPath] + anchor;
        return;
      }

      // Handle ../ prefixed links: strip prefix and re-check docRoutes
      const parentPrefixMatch = mdPath.match(/^\.\.\/(.+\.md)$/);
      if (parentPrefixMatch) {
        const basename = parentPrefixMatch[1];
        if (Object.prototype.hasOwnProperty.call(docRoutes, basename)) {
          node.url = docRoutes[basename] + anchor;
          return;
        }
      }

      // Handle skill-to-skill links: bare <slug>.md not in docRoutes
      const bareSlugMatch = mdPath.match(/^([^/]+)\.md$/);
      if (bareSlugMatch) {
        node.url = `/sdlc-marketplace/skills/${bareSlugMatch[1]}/` + anchor;
        return;
      }
    });
  };
}
