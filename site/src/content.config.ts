import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const skills = defineCollection({
  loader: glob({ pattern: '**/*.md', base: '../docs/skills' }),
  schema: z.object({}).passthrough(),
});

const guides = defineCollection({
  loader: glob({ pattern: '*.md', base: '../docs' }),
  schema: z.object({}).passthrough(),
});

export const collections = { skills, guides };
