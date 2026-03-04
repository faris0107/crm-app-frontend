const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
    const iconPath = 'icon.png';
    const androidResPath = 'android/app/src/main/res';
    const iosPath = 'ios/CRMApp/Images.xcassets/AppIcon.appiconset';

    const androidSizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    };

    console.log('Generating Android icons...');
    for (const [dir, size] of Object.entries(androidSizes)) {
        const outDirPath = path.join(androidResPath, dir);
        if (!fs.existsSync(outDirPath)) fs.mkdirSync(outDirPath, { recursive: true });

        await sharp(iconPath)
            .resize(size, size)
            .toFile(path.join(outDirPath, 'ic_launcher.png'));

        // For round icons, we can add a circular mask or just use the same image if it has a transparent background
        // Standard RN setup often just uses the same image
        await sharp(iconPath)
            .resize(size, size)
            .toFile(path.join(outDirPath, 'ic_launcher_round.png'));

        console.log(`- Created ${dir} icons (${size}x${size})`);
    }

    console.log('\nGenerating iOS icons...');
    const iosSizes = [
        { size: 20, idiom: 'iphone', scale: '2x', filename: 'icon-20@2x.png' },
        { size: 20, idiom: 'iphone', scale: '3x', filename: 'icon-20@3x.png' },
        { size: 29, idiom: 'iphone', scale: '1x', filename: 'icon-29.png' },
        { size: 29, idiom: 'iphone', scale: '2x', filename: 'icon-29@2x.png' },
        { size: 29, idiom: 'iphone', scale: '3x', filename: 'icon-29@3x.png' },
        { size: 40, idiom: 'iphone', scale: '2x', filename: 'icon-40@2x.png' },
        { size: 40, idiom: 'iphone', scale: '3x', filename: 'icon-40@3x.png' },
        { size: 60, idiom: 'iphone', scale: '2x', filename: 'icon-60@2x.png' },
        { size: 60, idiom: 'iphone', scale: '3x', filename: 'icon-60@3x.png' },
        { size: 1024, idiom: 'ios-marketing', scale: '1x', filename: 'icon-1024.png' }
    ];

    if (!fs.existsSync(iosPath)) {
        fs.mkdirSync(iosPath, { recursive: true });
    }

    for (const item of iosSizes) {
        const targetSize = Math.round(item.size * parseInt(item.scale));
        await sharp(iconPath)
            .resize(targetSize, targetSize)
            .toFile(path.join(iosPath, item.filename));
        console.log(`- Created iOS icon ${targetSize}x${targetSize}`);
    }

    // Update Contents.json for iOS
    const contents = {
        images: iosSizes.map(item => ({
            size: `${item.size}x${item.size}`,
            idiom: item.idiom,
            filename: item.filename,
            scale: item.scale
        })),
        info: { version: 1, author: 'xcode' }
    };
    fs.writeFileSync(path.join(iosPath, 'Contents.json'), JSON.stringify(contents, null, 2));
    console.log('\nUpdated Contents.json for iOS');
}

generateIcons().catch(console.error);
