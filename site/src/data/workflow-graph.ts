export interface WorkflowNode {
  slug: string;
  command: string;
  category: 'planning' | 'review' | 'gitops' | 'integrations';
  lane: 'plan' | 'review' | 'ship';
  col: number;
  tagline: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dashed' | 'cross-lane';
}

export const workflowNodes: WorkflowNode[] = [
  // Plan lane
  { slug: 'jira-sdlc', command: '/jira-sdlc', category: 'integrations', lane: 'plan', col: 0, tagline: 'Create & manage Jira issues' },
  { slug: 'plan-sdlc', command: '/plan-sdlc', category: 'planning', lane: 'plan', col: 1, tagline: 'Write implementation plans' },
  { slug: 'execute-plan-sdlc', command: '/execute-plan-sdlc', category: 'planning', lane: 'plan', col: 2, tagline: 'Execute plans with parallel waves' },
  // Review lane
  { slug: 'review-init-sdlc', command: '/review-init-sdlc', category: 'review', lane: 'review', col: 0, tagline: 'Initialize review dimensions' },
  { slug: 'review-sdlc', command: '/review-sdlc', category: 'review', lane: 'review', col: 1, tagline: 'Multi-dimension code review' },
  { slug: 'review-receive-sdlc', command: '/review-receive-sdlc', category: 'review', lane: 'review', col: 2, tagline: 'Process review feedback' },
  // Ship lane
  { slug: 'commit-sdlc', command: '/commit-sdlc', category: 'gitops', lane: 'ship', col: 0, tagline: 'Smart commit message generation' },
  { slug: 'pr-sdlc', command: '/pr-sdlc', category: 'gitops', lane: 'ship', col: 1, tagline: 'Create structured pull requests' },
  { slug: 'version-sdlc', command: '/version-sdlc', category: 'gitops', lane: 'ship', col: 2, tagline: 'Bump version and create release' },
];

export const workflowEdges: WorkflowEdge[] = [
  // Plan lane flow
  { from: 'jira-sdlc', to: 'plan-sdlc', label: 'informs', style: 'solid' },
  { from: 'plan-sdlc', to: 'execute-plan-sdlc', label: 'executes', style: 'solid' },
  // Review lane flow
  { from: 'review-init-sdlc', to: 'review-sdlc', label: 'configures', style: 'solid' },
  { from: 'review-sdlc', to: 'review-receive-sdlc', label: 'findings to', style: 'solid' },
  // Ship lane flow
  { from: 'commit-sdlc', to: 'pr-sdlc', label: 'staged for', style: 'solid' },
  { from: 'pr-sdlc', to: 'version-sdlc', label: 'merged then', style: 'solid' },
  // Cross-lane
  { from: 'execute-plan-sdlc', to: 'review-sdlc', label: 'feeds into', style: 'cross-lane' },
  { from: 'review-receive-sdlc', to: 'commit-sdlc', label: 'fixes flow into', style: 'cross-lane' },
  { from: 'execute-plan-sdlc', to: 'commit-sdlc', label: 'or ship directly', style: 'cross-lane' },
];

export const laneLabels: Record<string, string> = {
  plan: 'PLAN',
  review: 'REVIEW',
  ship: 'SHIP',
};

export const laneOrder = ['plan', 'review', 'ship'] as const;
