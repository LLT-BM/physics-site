import { getCollection, type CollectionEntry } from 'astro:content';

export type Model = CollectionEntry<'models'>;

/** Дата ↓, при равных датах больший order (новее) ↑, затем id. */
function cmp(a: Model, b: Model){
  const d = b.data.date.getTime() - a.data.date.getTime();
  if (d) return d;
  const o = (b.data.order ?? 0) - (a.data.order ?? 0);
  if (o) return o;
  return a.id.localeCompare(b.id);
}

export async function published(now = new Date()){
  const all = await getCollection('models');
  return all.filter(m => !m.data.draft && m.data.date.getTime() <= now.getTime()).sort(cmp);
}

/** Сквозные номера без пропусков: 01 — самая ранняя. */
export async function numbered(){
  const list = await published();
  const asc = list.slice().reverse();
  const num = new Map(asc.map((m,i) => [m.id, String(i+1).padStart(2,'0')]));
  return list.map(m => ({ m, num: num.get(m.id)! }));
}

export async function sections(){
  const list = await published();
  const map = new Map<string, Model[]>();
  for (const m of list){
    const s = m.data.section;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(m);
  }
  return [...map.entries()].sort((a,b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export async function tagIndex(){
  const list = await published();
  const map = new Map<string, Model[]>();
  for (const m of list) for (const t of m.data.tags){
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(m);
  }
  return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]));
}

export async function neighbours(id: string){
  const list = await published();
  const i = list.findIndex(m => m.id === id);
  return { prev: i > 0 ? list[i-1] : null, next: i >= 0 && i < list.length-1 ? list[i+1] : null };
}