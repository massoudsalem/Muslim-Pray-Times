ICONS NEEDED:
=============

Place the following PNG files in this directory:
- icon-16.png (16×16 px)
- icon-32.png (32×32 px)
- icon-48.png (48×48 px)
- icon-128.png (128×128 px)

For now, you can use the existing firebase/icons/pray-times-48.png and resize it:
1. Open the file in any image editor (Paint, GIMP, etc.)
2. Export as PNG at the sizes above

Or use this command line (requires ImageMagick):
  convert firebase/icons/pray-times-48.png -resize 16x16 extension/assets/icons/icon-16.png
  convert firebase/icons/pray-times-48.png -resize 32x32 extension/assets/icons/icon-32.png
  convert firebase/icons/pray-times-48.png -resize 48x48 extension/assets/icons/icon-48.png
  convert firebase/icons/pray-times-48.png -resize 128x128 extension/assets/icons/icon-128.png
