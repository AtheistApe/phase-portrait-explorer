import { parse } from 'mathjs';

const RESERVED = new Set([
  'x', 'y', 't',
  'pi', 'e', 'i', 'Infinity', 'NaN',
  'true', 'false', 'null', 'undefined',
]);

/**
 * Collect free parameter symbols from a parsed mathjs AST node, skipping
 * the reserved set above and skipping function-name SymbolNodes that
 * appear as a FunctionNode's `fn` (so sin, cos, etc. are not parameters).
 */
function collectParameters(node, out) {
  node.traverse((n, path, parent) => {
    if (!n.isSymbolNode) return;
    if (RESERVED.has(n.name)) return;
    if (parent && parent.isFunctionNode && path === 'fn') return;
    out.add(n.name);
  });
}

/**
 * Parse + compile an RHS pair in a single pass. This is the only function
 * the store needs; the older two-step API below is kept for the test suite
 * and any future callers that want validation without compilation.
 *
 * Returns either { ok: true, f, g, paramNames } or { ok: false, error }.
 *
 *   f(x, y, params) and g(x, y, params) return numbers.
 *
 * The compiled scope object is allocated once and mutated per call to avoid
 * GC pressure during integration. With math.js this is roughly an order of
 * magnitude faster than building a fresh scope each step. Parameter values
 * are written into the shared scope before each evaluation, so consecutive
 * calls with different `params` objects work correctly.
 */
export function parseAndCompile(fExpr, gExpr) {
  let fNode, gNode;
  try {
    fNode = parse(fExpr);
  } catch (e) {
    return { ok: false, error: `dx/dt: ${e.message}` };
  }
  try {
    gNode = parse(gExpr);
  } catch (e) {
    return { ok: false, error: `dy/dt: ${e.message}` };
  }

  const paramSet = new Set();
  collectParameters(fNode, paramSet);
  collectParameters(gNode, paramSet);
  const paramNames = Array.from(paramSet).sort();

  const fCompiled = fNode.compile();
  const gCompiled = gNode.compile();

  const scope = { x: 0, y: 0 };
  for (const name of paramNames) scope[name] = 0;

  // Hoist the param-name list into a closure-local so the hot path doesn't
  // touch the array allocator. Empty-params case skips the param copy loop
  // entirely.
  const np = paramNames.length;
  const names = paramNames;

  const f = np === 0
    ? (x, y) => { scope.x = x; scope.y = y; return fCompiled.evaluate(scope); }
    : (x, y, params) => {
        scope.x = x;
        scope.y = y;
        if (params) {
          for (let i = 0; i < np; i++) scope[names[i]] = params[names[i]];
        }
        return fCompiled.evaluate(scope);
      };

  const g = np === 0
    ? (x, y) => { scope.x = x; scope.y = y; return gCompiled.evaluate(scope); }
    : (x, y, params) => {
        scope.x = x;
        scope.y = y;
        if (params) {
          for (let i = 0; i < np; i++) scope[names[i]] = params[names[i]];
        }
        return gCompiled.evaluate(scope);
      };

  return { ok: true, f, g, paramNames };
}

// ─── Legacy API kept for the test suite ──────────────────────────────────

/**
 * Compile a system of two RHS expressions. Wrapper around parseAndCompile
 * that ignores the supplied paramNames (they're rediscovered from the AST).
 */
export function compileSystem(fExpr, gExpr) {
  const r = parseAndCompile(fExpr, gExpr);
  if (!r.ok) throw new Error(r.error);
  return { f: r.f, g: r.g };
}

export function extractParameters(expressions) {
  const found = new Set();
  for (const expr of expressions) {
    if (!expr || typeof expr !== 'string') continue;
    let node;
    try { node = parse(expr); } catch { continue; }
    collectParameters(node, found);
  }
  return Array.from(found).sort();
}

export function validateSystem(fExpr, gExpr) {
  try { parse(fExpr); } catch (e) { return { ok: false, error: `dx/dt: ${e.message}` }; }
  try { parse(gExpr); } catch (e) { return { ok: false, error: `dy/dt: ${e.message}` }; }
  return { ok: true };
}
