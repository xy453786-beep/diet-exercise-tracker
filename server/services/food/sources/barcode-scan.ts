// ============================================================
// 条码扫描模块 — @zxing/library 纯 JS 实现
//
// 在调用任何 LLM 之前先扫描图片中的条形码。
// 如果检测到条码 → 直接查 Open Food Facts，秒级返回。
// ============================================================

/**
 * 使用 @zxing/library 纯 JS 库扫描图片中的条码
 *
 * @param imageUrl - 图片 URL
 * @returns 条码数字数组
 */
async function scanWithZxing(imageUrl: string): Promise<string[]> {
  try {
    // 下载图片
    const resp = await fetch(imageUrl.trim(), {
      headers: { 'User-Agent': 'DietTrackerApp/1.0' },
    });
    if (!resp.ok) {
      console.warn('[barcode-scan/zxing] 下载图片失败:', resp.status);
      return [];
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    const base64 = buffer.toString('base64');

    // 使用 zxing 的纯 JS 解码器
    const {
      MultiFormatReader,
      BarcodeFormat,
      DecodeHintType,
      RGBLuminanceSource,
      BinaryBitmap,
      HybridBinarizer,
    } = await import('@zxing/library');

    // 加载图片像素数据（用 sharp 解码）
    const sharp = await import('sharp');
    const { data, info } = await sharp(buffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const hints = new Map();
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(data),
      info.width,
      info.height
    );
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    try {
      const result = reader.decode(binaryBitmap);
      if (result) {
        console.log(`[barcode-scan/zxing] ✅ 检测到条码: ${result.getText()} (${result.getBarcodeFormat()})`);
        return [result.getText()];
      }
    } catch {
      // No barcode found is not an error in zxing
    }

    return [];
  } catch (err: any) {
    console.warn('[barcode-scan/zxing] 扫描异常:', err.message);
    return [];
  }
}

/**
 * 扫描图片中的条码
 *
 * @param imageUrl - 图片 URL（Supabase Storage 公开链接）
 * @returns 条码数字数组，失败或无条码时返回空数组
 */
export async function scanImageForBarcodes(imageUrl: string): Promise<string[]> {
  return scanWithZxing(imageUrl);
}
