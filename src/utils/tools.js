

export function isV5008(topic) {
  return topic.startsWith('V5008');
} 

export function isV6800(topic) {
  return topic.startsWith('V6800');
}


export function isG6000(topic) {
  return topic.startsWith('G6000');
}


export function formatTimestamp(date) {
  const timestampOptions = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  return date.toLocaleString('en-US', timestampOptions).replace(',', '');
}

function isValidIdentifier(str) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(str);
}

function colorKey(text) {
  return `<span style="color: #000000ff;">${text}</span>`;
}

function colorString(text) {
  return `<span style="color: #0b770bff;">'${text}'</span>`; // green
}

function colorNumber(text) {
  return `<span style="color: #b1b10fff;">${text}</span>`; // yellow
}

function formatObject(obj, indent) {
  const pad = '  '.repeat(indent);
  const maxKeyLength = Math.max(
    ...Object.keys(obj).map(k => (isValidIdentifier(k) ? k.length : k.length + 2))
  );

  return Object.entries(obj)
    .map(([k, v]) => {
      const keyStr = isValidIdentifier(k) ? k : `'${k}'`;
      const spaces = ' ';//.repeat(maxKeyLength - keyStr.length);
      return `${'  '.repeat(indent + 1)}${colorKey(keyStr)}${spaces}: ${formatValue(v, indent + 1)}`;
    })
    .join(',\n');
}



export function formatValue(value, indent = 0) {
  const pad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    const isSimpleObjectArray =
      value.length > 0 &&
      value.every(
        v =>
          typeof v === 'object' &&
          v !== null &&
          !Array.isArray(v) &&
          Object.values(v).every(
            val => typeof val === 'string' || typeof val === 'number' || val === null
          )
      );

    if (isSimpleObjectArray) {
      const maxKeyLength = Math.max(
        ...value.flatMap(obj =>
          Object.keys(obj).map(k => (isValidIdentifier(k) ? k.length : k.length + 2))
        )
      );

      const arrStr = value
        .map(obj => {
          const fields = Object.entries(obj)
            .map(([k, val]) => {
              const keyStr = isValidIdentifier(k) ? k : `'${k}'`;
              const spaces = ' '.repeat(maxKeyLength - keyStr.length);
              return `${colorKey(keyStr)}${spaces}: ${
                typeof val === 'string' ? colorString(val) : colorNumber(val)
              }`;
            })
            .join(', ');
          return `{ ${fields} }`;
        })
        .join(',\n' + '  '.repeat(indent + 1));
      return `[\n${'  '.repeat(indent + 1)}${arrStr}\n${pad}]`;
    } else {
      const arrStr = value.map(v => formatValue(v, indent + 1)).join(',\n');
      return `[\n${arrStr}\n${pad}]`;
    }
  } else if (typeof value === 'object' && value !== null) {
    return `{\n${formatObject(value, indent)}\n${pad}}`;
  } else if (typeof value === 'string') {
    return colorString(value);
  } else if (typeof value === 'number') {
    return colorNumber(value);
  } else {
    return String(value);
  }
}

