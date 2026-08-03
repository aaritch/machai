import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';
import { REDACTED, redact, redactString } from './redact';

/**
 * TASK-08 security scenario, stated as a hard requirement:
 *
 *   "Given a log line containing an EIN-like value, when emitted, then the
 *    scrubber redacts it (verified by a test asserting the value never appears
 *    in output)."
 *
 * These tests assert absence, not shape. That is the only assertion that
 * actually proves the control.
 */

describe('value-pattern redaction', () => {
  it('removes a formatted EIN from free text', () => {
    const output = redactString('pull failed for EIN 12-3456789 at bureau');
    expect(output).not.toContain('12-3456789');
    expect(output).toContain(REDACTED);
  });

  it('removes a bare nine-digit EIN from free text', () => {
    const output = redactString('taxId=123456789 rejected');
    expect(output).not.toContain('123456789');
  });

  it('removes an SSN-formatted value even though we never collect one', () => {
    const output = redactString('subject 123-45-6789');
    expect(output).not.toContain('123-45-6789');
  });

  it('removes card-length digit runs', () => {
    const output = redactString('card 4242 4242 4242 4242 declined');
    expect(output).not.toContain('4242 4242 4242 4242');
  });

  it('removes Stripe keys and bearer tokens', () => {
    expect(redactString('sk_live_abcdefgh12345678')).not.toContain('abcdefgh12345678');
    expect(redactString('authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
  });
});

describe('key-name redaction', () => {
  it('redacts sensitive keys regardless of their value format', () => {
    const output = redact({ ein: 'not-a-number-shape', password: 'hunter2', ok: 'visible' }) as Record<
      string,
      unknown
    >;
    expect(output.ein).toBe(REDACTED);
    expect(output.password).toBe(REDACTED);
    expect(output.ok).toBe('visible');
  });

  it('redacts at depth, inside nested objects and arrays', () => {
    const output = JSON.stringify(
      redact({ business: { profile: { taxId: '123456789' } }, list: [{ apiKey: 'abc123456' }] }),
    );
    expect(output).not.toContain('123456789');
    expect(output).not.toContain('abc123456');
  });

  it('redacts a raw bureau payload wholesale', () => {
    const output = redact({ raw_payload: { score: 78, subject: '12-3456789' } }) as Record<string, unknown>;
    expect(output.raw_payload).toBe(REDACTED);
  });
});

describe('robustness', () => {
  it('survives circular references', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
    expect(JSON.stringify(redact(cyclic))).toContain('[circular]');
  });

  it('caps very long strings', () => {
    const output = redactString('x'.repeat(5000));
    expect(output.length).toBeLessThan(5000);
    expect(output).toContain('[truncated]');
  });

  it('serializes Errors without leaking sensitive content from the message', () => {
    const output = JSON.stringify(redact(new Error('failed for 12-3456789')));
    expect(output).not.toContain('12-3456789');
  });
});

describe('logger integration', () => {
  it('scrubs everything on the way to the sink', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'debug', sink: (line) => lines.push(line) });

    logger.info('pull requested', {
      businessId: 'b-123',
      ein: '123456789',
      nested: { note: 'EIN 12-3456789 supplied' },
    });

    const output = lines.join('\n');
    expect(output).toContain('b-123');
    expect(output).not.toContain('123456789');
    expect(output).not.toContain('12-3456789');
  });

  it('carries child bindings into every line', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'debug', sink: (line) => lines.push(line) }).child({
      consumer: 'report-pull',
    });
    logger.warn('retrying');
    expect(lines[0]).toContain('report-pull');
  });

  it('respects the level threshold', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'warn', sink: (line) => lines.push(line) });
    logger.debug('noise');
    logger.info('noise');
    logger.error('signal');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('signal');
  });
});
