const APPROVE = /^APPROVE\b/u;

// True when line 1 of the reply is DONE and line 2 starts with APPROVE, the
// verdict warden puts on the line after its status word.
export function isApproval(message: string): boolean {
  const [status = '', verdict = ''] = message.split('\n');

  return status.trim() === 'DONE' && APPROVE.test(verdict.trim());
}
