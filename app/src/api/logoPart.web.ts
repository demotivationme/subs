/** The picker gives a blob: or data: uri on web; fetch turns it into the Blob FormData needs. */
export async function logoPart(uri: string): Promise<[Blob, string]> {
  return [await (await fetch(uri)).blob(), 'logo.jpg'];
}
