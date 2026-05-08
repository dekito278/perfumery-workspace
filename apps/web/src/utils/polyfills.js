if (!Promise.withResolvers) {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });

    return { promise, resolve, reject };
  };
}

if (!Promise.allSettled) {
  Promise.allSettled = (iterable) => Promise.all(
    Array.from(iterable).map((item) => Promise.resolve(item)
      .then((value) => ({ status: 'fulfilled', value }))
      .catch((reason) => ({ status: 'rejected', reason })))
  );
}

if (!Promise.try) {
  Promise.try = (callback, ...args) => new Promise((resolve) => {
    resolve(callback(...args));
  });
}

if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, 'flatMap', {
    value(callback, thisArg) {
      return Array.prototype.concat.apply([], this.map(callback, thisArg));
    },
    configurable: true,
    writable: true,
  });
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value(index) {
      const length = this.length;
      const relativeIndex = Number(index) || 0;
      const absoluteIndex = relativeIndex < 0 ? length + relativeIndex : relativeIndex;
      return absoluteIndex < 0 || absoluteIndex >= length ? undefined : this[absoluteIndex];
    },
    configurable: true,
    writable: true,
  });
}

if (!String.prototype.replaceAll) {
  Object.defineProperty(String.prototype, 'replaceAll', {
    value(searchValue, replaceValue) {
      if (searchValue instanceof RegExp) {
        if (!searchValue.global) {
          throw new TypeError('String.prototype.replaceAll called with a non-global RegExp');
        }
        return this.replace(searchValue, replaceValue);
      }

      return this.split(String(searchValue)).join(String(replaceValue));
    },
    configurable: true,
    writable: true,
  });
}

if (!Object.fromEntries) {
  Object.fromEntries = (entries) => {
    const object = {};
    for (const [key, value] of entries) {
      object[key] = value;
    }
    return object;
  };
}

if (!Object.hasOwn) {
  Object.hasOwn = (object, property) => Object.prototype.hasOwnProperty.call(Object(object), property);
}

if (!URL.parse) {
  URL.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

if (typeof structuredClone !== 'function') {
  globalThis.structuredClone = (value) => {
    if (value instanceof ArrayBuffer) {
      return value.slice(0);
    }

    if (ArrayBuffer.isView(value)) {
      return new value.constructor(value);
    }

    if (value instanceof Map) {
      return new Map(value);
    }

    if (value instanceof Set) {
      return new Set(value);
    }

    if (value && typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        if (Array.isArray(value)) {
          return value.slice();
        }
        return { ...value };
      }
    }

    return value;
  };
}

if (typeof Response !== 'undefined' && !Response.prototype.bytes) {
  Object.defineProperty(Response.prototype, 'bytes', {
    async value() {
      return new Uint8Array(await this.arrayBuffer());
    },
    configurable: true,
    writable: true,
  });
}
