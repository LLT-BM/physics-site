import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const models = await getCollection('models');
  return rss({
    title: 'LibLabTab — интерактивные модели физики',
    description: 'Новая интерактивная модель каждый день.',
    site: context.site,
    items: models
      .sort((a, b) => b.data.date - a.data.date)
      .map((m) => ({
        title: m.data.title,
        pubDate: m.data.date,
        description: m.data.description,
        link: `/models/${m.id}/`,
      })),
  });
}