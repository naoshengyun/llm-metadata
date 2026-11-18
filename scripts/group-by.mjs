/** Group in encounter order on the repository's supported Node versions. */
export function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}
