export const maxAssetImageBytes = 2 * 1024 * 1024;
export function assetImageFormat(bytes) {
  if (!bytes.length || bytes.length > maxAssetImageBytes) throw new Error('IMAGE_SIZE');
  const starts=(...values)=>values.every((value,index)=>bytes[index]===value);
  if (starts(137,80,78,71,13,10,26,10)) return {mime:'image/png',extension:'png'};
  if (starts(255,216,255)) return {mime:'image/jpeg',extension:'jpg'};
  if (starts(82,73,70,70) && [87,69,66,80].every((v,i)=>bytes[8+i]===v)) return {mime:'image/webp',extension:'webp'};
  throw new Error('IMAGE_FORMAT');
}
