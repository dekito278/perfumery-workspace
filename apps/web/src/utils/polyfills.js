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

if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    constructor(init) {
      const values = Array.isArray(init) || ArrayBuffer.isView(init) ? Array.from(init) : null;
      this.a = Number(values?.[0] ?? 1);
      this.b = Number(values?.[1] ?? 0);
      this.c = Number(values?.[2] ?? 0);
      this.d = Number(values?.[3] ?? 1);
      this.e = Number(values?.[4] ?? 0);
      this.f = Number(values?.[5] ?? 0);
      this.m11 = this.a;
      this.m12 = this.b;
      this.m21 = this.c;
      this.m22 = this.d;
      this.m41 = this.e;
      this.m42 = this.f;
      this.is2D = true;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
    }

    _sync() {
      this.m11 = this.a;
      this.m12 = this.b;
      this.m21 = this.c;
      this.m22 = this.d;
      this.m41 = this.e;
      this.m42 = this.f;
      this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      return this;
    }

    multiplySelf(other = new DOMMatrixPolyfill()) {
      const matrix = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const { a, b, c, d, e, f } = this;
      this.a = a * matrix.a + c * matrix.b;
      this.b = b * matrix.a + d * matrix.b;
      this.c = a * matrix.c + c * matrix.d;
      this.d = b * matrix.c + d * matrix.d;
      this.e = a * matrix.e + c * matrix.f + e;
      this.f = b * matrix.e + d * matrix.f + f;
      return this._sync();
    }

    preMultiplySelf(other = new DOMMatrixPolyfill()) {
      const matrix = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const current = new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]);
      this.a = matrix.a;
      this.b = matrix.b;
      this.c = matrix.c;
      this.d = matrix.d;
      this.e = matrix.e;
      this.f = matrix.f;
      return this.multiplySelf(current);
    }

    multiply(other) {
      return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(other);
    }

    translateSelf(x = 0, y = 0) {
      return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 1, Number(x) || 0, Number(y) || 0]));
    }

    translate(x = 0, y = 0) {
      return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).translateSelf(x, y);
    }

    scaleSelf(scaleX = 1, scaleY = scaleX) {
      return this.multiplySelf(new DOMMatrixPolyfill([Number(scaleX) || 0, 0, 0, Number(scaleY) || 0, 0, 0]));
    }

    scale(scaleX = 1, scaleY = scaleX) {
      return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).scaleSelf(scaleX, scaleY);
    }

    invertSelf() {
      const determinant = this.a * this.d - this.b * this.c;
      if (!determinant) {
        this.a = Number.NaN;
        this.b = Number.NaN;
        this.c = Number.NaN;
        this.d = Number.NaN;
        this.e = Number.NaN;
        this.f = Number.NaN;
        return this._sync();
      }

      const { a, b, c, d, e, f } = this;
      this.a = d / determinant;
      this.b = -b / determinant;
      this.c = -c / determinant;
      this.d = a / determinant;
      this.e = (c * f - d * e) / determinant;
      this.f = (b * e - a * f) / determinant;
      return this._sync();
    }

    inverse() {
      return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf();
    }

    toFloat32Array() {
      return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]);
    }

    toFloat64Array() {
      return new Float64Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]);
    }
  }

  globalThis.DOMMatrix = DOMMatrixPolyfill;
  globalThis.DOMMatrixReadOnly = DOMMatrixPolyfill;
}
