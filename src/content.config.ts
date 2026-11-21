import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

export const SECTIONS = [
  'механика','электричество','оптика','молекулярная-физика',
  'квантовая-физика','нелинейная-динамика','гидродинамика','астрономия'
] as const;
export const LEVELS = ['базовый','продвинутый'] as const;
export const GRADES = ['7-9','10-11','вуз'] as const;
export const TAGS = [
  'школьный-курс','хаос','колебания','статика','геометрическая-оптика',
  'постоянный-ток','переменный-ток','ван-дер-ваальс','клеточные-автоматы',
  'масштабы','численные-методы','3d'
] as const;

const models = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/models' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    /** Одна-две фразы под заголовком. Единственная теория, видимая сразу. */
    lead: z.string().optional(),
    tags: z.array(z.enum(TAGS)).default([]),
    model: z.string(),
    cover: z.string(),
    section: z.enum(SECTIONS),
    level: z.enum(LEVELS).default('базовый'),
    grade: z.enum(GRADES).optional(),
    order: z.number().int().positive(),
    coreVersion: z.string().default('1'),
    draft: z.boolean().default(false),
    /** Эталонные значения для сверки. Блок свёрнут по умолчанию. */
    checkpoints: z.array(z.object({
      name: z.string(), setup: z.string(), expected: z.string()
    })).default([]),
    /** Что модель упрощает. Блок свёрнут по умолчанию. */
    limits: z.array(z.string()).default([]),
    aliases: z.array(z.string()).default([])
  })
});

export const collections = { models };