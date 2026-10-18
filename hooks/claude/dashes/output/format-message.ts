import { formatMessage as formatSharedMessage } from '../../../shared/format-message.ts';

export function formatMessage(detail: string): string {
  return formatSharedMessage('dashes', detail);
}
