// Matching icons must never fall back to their filenames, URLs or authored labels.
export function looksLikeMatchMedia(value) {
  return typeof value === 'string' && /^(?:https?:|data:|blob:|file:|javascript:|ftp:|\/|\.\.?\/|www\.)/i.test(value.trim());
}
export function matchMediaSource(item) {
  const label = String(item?.label ?? item?.left ?? '').trim();
  const explicit = String(item?.image ?? item?.leftImage ?? '').trim();
  return explicit || (looksLikeMatchMedia(label) ? label : '');
}
export function normalizeMatchItem(item, resolveMedia) {
  const source = matchMediaSource(item);
  if (source) return {label:'', image:resolveMedia(source) || '', icon:true};
  if (item?.icon) return {label:'', image:'', icon:true};
  return {label:String(item?.label ?? item?.left ?? '').trim().slice(0,1000),image:''};
}
