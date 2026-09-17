import { describe, expect, it } from 'vitest';
import { finishComponentPanels, precisionControlRim } from './component-panel-finish.mjs';
import { componentHardwareDetails } from './component-hardware-details.mjs';

describe('component finish placement', () => {
  const outline = 'M139 61h22v47h-22Z';
  const contents = '<circle data-content="preserved" cx="150" cy="80" r="3"/>';
  const panel = `<g data-detail="solver-telemetry" transform="translate(3 4)"><path d="${outline}" fill="#081221"/>${contents}</g>`;

  it('keeps contents above the finish and clips details to the original outline', () => {
    const result = finishComponentPanels(panel, 'body');
    expect(result).toContain(`clipPathUnits="userSpaceOnUse"><path d="${outline}"/>`);
    expect(result).toContain('transform="translate(3 4)"');
    expect(result).toContain(contents);
    expect(result.indexOf('panel-edge-joints')).toBeLessThan(result.indexOf(contents));
    expect(result.indexOf('fitted-component-hardware')).toBeLessThan(result.indexOf(contents));
    expect(result).not.toContain('<text');
    expect(result).not.toContain('<rect');
  });

  it('accepts compact negative SVG coordinates on local diagnostic modules', () => {
    expect(componentHardwareDetails('audit', 'diagnostic-category-cell', 'M-15-8H12l5 5V9Z'))
      .toContain('captive-panel-latch');
  });

  it('anchors drawer fittings to each drawer instead of repeating global coordinates', () => {
    const first = componentHardwareDetails('memory', 'memory-layer', 'M54 61h59l10 8v14H54Z');
    const second = componentHardwareDetails('memory', 'memory-layer', 'M54 86h59l10 8v14H54Z');
    expect(first).toContain('translate(120 71)');
    expect(second).toContain('translate(120 96)');
  });

  it('does not add hardware to the app logo or unmatched semantic content', () => {
    expect(componentHardwareDetails('app-alice', 'alice-face', 'M0 0h10v10Z')).toBe('');
    expect(componentHardwareDetails('avatar', 'alice-face', 'M0 0h10v10Z')).toBe('');
  });

  it('uses unique local references for repeated panels', () => {
    const result = finishComponentPanels(panel + panel, 'body');
    const ids = [...result.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of result.matchAll(/url\(#([^\)]+)\)/g)) {
      expect([...ids, 'screw-metal']).toContain(match[1]);
    }
  });

  it('leaves independent shapes and animation instructions untouched', () => {
    const shape = '<g class="pulse"><circle cx="4" cy="4" r="2"/></g>';
    expect(finishComponentPanels(shape, 'rotate')).toBe(shape);
    expect(finishComponentPanels(panel + shape, 'body')).toContain(shape);
  });

  it('keeps camera-bearing details on the outside of the control glyph', () => {
    for (const id of ['rotate', 'pan', 'reset', 'zoom-in', 'zoom-out']) {
      const result = precisionControlRim(id, '#22d3ee', '#a78bfa');
      expect(result).toContain('control-recessed-bearing');
      const radii = [...result.matchAll(/\br="([\d.]+)"/g)].map(match => Number(match[1]));
      expect(Math.min(...radii)).toBeGreaterThan(47);
      expect(result).not.toContain('<text');
    }
  });
});
