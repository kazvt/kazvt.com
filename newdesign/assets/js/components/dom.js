export function node(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    if (key === "className") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "html") element.innerHTML = value;
    else if (key === "dataset") Object.entries(value).forEach(([dataKey, dataValue]) => element.dataset[dataKey] = dataValue);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value === true ? "" : value);
  });
  children.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

export function mount(target, children) {
  target.replaceChildren(...children.filter(Boolean));
}
