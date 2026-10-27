import type { SubmissionFile } from '@/campusVirtual'

export type PickOutcome =
  | { kind: 'picked'; files: SubmissionFile[] }
  | { kind: 'cancelled' }
  /** This app build has no file picker yet (its native module came with app 0.1.3). */
  | { kind: 'unavailable' }
  | { kind: 'failed' }

/**
 * The system file picker, for files to submit. expo-document-picker is loaded only when the
 * student taps: on an app build without its native module, loading it throws, and a top-level
 * import would take the whole screen (in development, every route) down with it.
 */
export async function pickFiles(): Promise<PickOutcome> {
  const picker = await import('expo-document-picker').catch(() => null)
  if (!picker) return { kind: 'unavailable' }
  try {
    const result = await picker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true })
    if (result.canceled) return { kind: 'cancelled' }
    return {
      kind: 'picked',
      files: result.assets.map((asset) => ({
        name: asset.name,
        bytes: asset.size ?? null,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        uri: asset.uri,
      })),
    }
  } catch {
    return { kind: 'failed' }
  }
}
