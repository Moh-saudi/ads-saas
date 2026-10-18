import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import * as website from '../web/lib/website-content.mjs';

// Exercise the actual public-page render while isolating unrelated Next routing
// and server-action forms. No hosted service, credentials or mutations are used.
export function checkPlaceRendering(brand) {
  const requireWeb = createRequire(new URL('../web/package.json', import.meta.url));
  const ts = requireWeb('typescript');
  const React = requireWeb('react');
  const { renderToString } = requireWeb('react-dom/server');
  const source = readFileSync(new URL('../web/components/public-site.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const requireComponent = (id) => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === '@/lib/website-types') return website;
    if (id === './enquiry-form') return { EnquiryForm: () => null };
    if (id === './hero-slider') return { HeroSlider: () => null };
    return requireWeb(id);
  };
  runInThisContext(`(function(exports,require){${compiled}\n})`)(exports, requireComponent);
  for (const image_url of [undefined, '']) {
    const html = renderToString(React.createElement(exports.PublicSite, {
      brand, catalog: [], demo: true, content: { places: [{ name: 'Cairo', image_url }] },
    }));
    assert.ok(html.includes('src="/media/agency/city-night.webp"'));
    assert.ok(html.includes('alt="تصور إبداعي لنطاق Cairo"'));
    assert.ok(html.includes('صورة تصورية'));
  }
}
