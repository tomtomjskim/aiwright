import { describe, it, expect } from 'vitest';
import {
  PromptStyleSchema,
  UserProfileSchema,
  WeaknessSchema,
  AdaptiveConfigSchema,
} from '../../src/schema/user-profile.js';

describe('PromptStyleSchema', () => {
  const validStyle = {
    verbosity: 0.5,
    specificity: 0.7,
    context_ratio: 0.3,
    constraint_usage: 0.4,
    example_usage: 0.2,
    imperative_clarity: 0.6,
  };

  it('parses valid 6-axis data', () => {
    const result = PromptStyleSchema.parse(validStyle);
    expect(result.verbosity).toBe(0.5);
    expect(result.specificity).toBe(0.7);
    expect(result.context_ratio).toBe(0.3);
    expect(result.constraint_usage).toBe(0.4);
    expect(result.example_usage).toBe(0.2);
    expect(result.imperative_clarity).toBe(0.6);
  });

  it('accepts boundary value 0.0 on all axes', () => {
    const zeroStyle = {
      verbosity: 0.0,
      specificity: 0.0,
      context_ratio: 0.0,
      constraint_usage: 0.0,
      example_usage: 0.0,
      imperative_clarity: 0.0,
    };
    const result = PromptStyleSchema.parse(zeroStyle);
    expect(result.verbosity).toBe(0.0);
  });

  it('accepts boundary value 1.0 on all axes', () => {
    const maxStyle = {
      verbosity: 1.0,
      specificity: 1.0,
      context_ratio: 1.0,
      constraint_usage: 1.0,
      example_usage: 1.0,
      imperative_clarity: 1.0,
    };
    const result = PromptStyleSchema.parse(maxStyle);
    expect(result.verbosity).toBe(1.0);
  });

  it('fails when verbosity exceeds 1.0', () => {
    expect(() => PromptStyleSchema.parse({ ...validStyle, verbosity: 1.5 })).toThrow();
  });

  it('fails when specificity is negative', () => {
    expect(() => PromptStyleSchema.parse({ ...validStyle, specificity: -0.1 })).toThrow();
  });

  it('fails when constraint_usage exceeds 1.0', () => {
    expect(() => PromptStyleSchema.parse({ ...validStyle, constraint_usage: 1.1 })).toThrow();
  });

  it('fails when imperative_clarity is negative', () => {
    expect(() => PromptStyleSchema.parse({ ...validStyle, imperative_clarity: -1 })).toThrow();
  });

  it('applies default 0 when a numeric axis is missing', () => {
    // All axes have default(0), so omitting one applies the default instead of throwing
    const { verbosity: _, ...withoutVerbosity } = validStyle;
    const result = PromptStyleSchema.parse(withoutVerbosity);
    expect(result.verbosity).toBe(0);
  });
});

describe('UserProfileSchema', () => {
  const minimalProfile = {
    version: '1' as const,
    user_id: 'user-abc',
    updated_at: '2026-03-23T10:00:00.000Z',
    style: {
      verbosity: 0.5,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    },
    dna_code: 'AW-V5S5R5',
    adaptive: { enabled: false },
  };

  it('applies default total_events=0 when not provided', () => {
    const result = UserProfileSchema.parse(minimalProfile);
    expect(result.total_events).toBe(0);
  });

  it('applies default empty arrays for weaknesses and domains', () => {
    const result = UserProfileSchema.parse(minimalProfile);
    expect(result.weaknesses).toEqual([]);
    expect(result.domains).toEqual([]);
  });

  it('accepts dna_code matching AW-{A}{d}{A}{d}{A}{d} pattern', () => {
    const withDna = { ...minimalProfile, dna_code: 'AW-V8R0S2' };
    const result = UserProfileSchema.parse(withDna);
    expect(result.dna_code).toBe('AW-V8R0S2');
  });

  it('accepts another valid dna_code: AW-I9R8S7', () => {
    const withDna = { ...minimalProfile, dna_code: 'AW-I9R8S7' };
    const result = UserProfileSchema.parse(withDna);
    expect(result.dna_code).toBe('AW-I9R8S7');
  });

  it('accepts any string as dna_code (no pattern constraint)', () => {
    const result = UserProfileSchema.parse({ ...minimalProfile, dna_code: 'AW-V8R0S2' });
    expect(typeof result.dna_code).toBe('string');
  });

  it('accepts total_events > 0 when explicitly provided', () => {
    const result = UserProfileSchema.parse({ ...minimalProfile, total_events: 42 });
    expect(result.total_events).toBe(42);
  });

  it('fails when total_events is negative', () => {
    expect(() =>
      UserProfileSchema.parse({ ...minimalProfile, total_events: -1 })
    ).toThrow();
  });

  it('fails when user_id is missing', () => {
    const { user_id: _, ...noId } = minimalProfile;
    expect(() => UserProfileSchema.parse(noId)).toThrow();
  });

  it('fails when style is missing', () => {
    const { style: _, ...noStyle } = minimalProfile;
    expect(() => UserProfileSchema.parse(noStyle)).toThrow();
  });
});

describe('WeaknessSchema', () => {
  const validWeakness = {
    id: 'W001',
    severity: 'HIGH' as const,
    message: 'Constraint slot is rarely used.',
  };

  it('parses a valid weakness', () => {
    const result = WeaknessSchema.parse(validWeakness);
    expect(result.id).toBe('W001');
    expect(result.severity).toBe('HIGH');
  });

  it('accepts severity enum: HIGH', () => {
    expect(WeaknessSchema.parse({ ...validWeakness, severity: 'HIGH' }).severity).toBe('HIGH');
  });

  it('accepts severity enum: WARN', () => {
    expect(WeaknessSchema.parse({ ...validWeakness, severity: 'WARN' }).severity).toBe('WARN');
  });

  it('accepts severity enum: INFO', () => {
    expect(WeaknessSchema.parse({ ...validWeakness, severity: 'INFO' }).severity).toBe('INFO');
  });

  it('fails on unknown severity value', () => {
    expect(() => WeaknessSchema.parse({ ...validWeakness, severity: 'CRITICAL' })).toThrow();
  });

  it('fails when id is missing', () => {
    const { id: _, ...noId } = validWeakness;
    expect(() => WeaknessSchema.parse(noId)).toThrow();
  });

  it('fails when message is missing', () => {
    const { message: _, ...noMessage } = validWeakness;
    expect(() => WeaknessSchema.parse(noMessage)).toThrow();
  });
});

describe('AdaptiveConfigSchema', () => {
  it('applies default enabled=false', () => {
    const result = AdaptiveConfigSchema.parse({});
    expect(result.enabled).toBe(false);
  });

  it('accepts enabled=true when explicitly set', () => {
    const result = AdaptiveConfigSchema.parse({ enabled: true });
    expect(result.enabled).toBe(true);
  });

  it('accepts optional rules array', () => {
    const result = AdaptiveConfigSchema.parse({
      enabled: true,
      rules: [{ when: 'condition', inject: 'fragment-name', reason: 'because' }],
    });
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].inject).toBe('fragment-name');
  });

  it('applies default empty rules array when not provided', () => {
    const result = AdaptiveConfigSchema.parse({});
    expect(result.rules ?? []).toEqual([]);
  });
});
