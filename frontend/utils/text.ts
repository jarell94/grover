export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const splitHighlightedParts = (text: string, query: string) => {
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.split(regex);
};
