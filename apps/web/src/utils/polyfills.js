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

if (!Object.fromEntries) {
  Object.fromEntries = (entries) => {
    const object = {};
    for (const [key, value] of entries) {
      object[key] = value;
    }
    return object;
  };
}
