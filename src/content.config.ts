import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const models = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/models' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    model: z.string(), // имя файла в public/sim/
  }),
});

export const collections = { models };