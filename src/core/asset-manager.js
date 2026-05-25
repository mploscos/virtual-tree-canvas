export class AssetManager {
  constructor() {
    this.images = new Map();
    this.iconIndices = new Map();
  }

  registerIcon(name) {
    if (!this.iconIndices.has(name)) this.iconIndices.set(name, this.iconIndices.size);
    return this.iconIndices.get(name);
  }

  async loadImage(name, url) {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    this.images.set(name, image);
    return image;
  }

  getImage(name) {
    return this.images.get(name) ?? null;
  }
}

